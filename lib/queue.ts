/**
 * RabbitMQ queue helpers for background OCR extraction.
 * Jobs are published to the `ocr.extract` durable queue and consumed by a
 * single in-process worker started from instrumentation.ts.
 */

import amqp from 'amqplib';
import type { Channel, ChannelModel } from 'amqplib';
import { OcrJob } from '@/models/OcrJob';
import { runOcrJob } from '@/lib/ocrJob';
import { connectDB } from '@/lib/mongodb';
export const RABBITMQ_URL:string =process.env.NODE_ENV==="development" ?process.env.RABBITMQ_URL as string :process.env.RABBITMQ_PRODUCTION_URL as string

export const OCR_QUEUE = 'ocr.extract';

let connPromise: Promise<ChannelModel> | null = null;
let channelPromise: Promise<Channel> | null = null;

async function getChannel(): Promise<Channel> {
  if (!connPromise) {
    connPromise = amqp.connect(RABBITMQ_URL);
    connPromise.catch(() => {
      connPromise = null;
      channelPromise = null;
    });
  }
  if (!channelPromise) {
    channelPromise = connPromise.then(async (conn) => {
      conn.on('close', () => {
        connPromise = null;
        channelPromise = null;
      });
      conn.on('error', () => {
        connPromise = null;
        channelPromise = null;
      });
      const ch = await conn.createChannel();
      await ch.assertQueue(OCR_QUEUE, { durable: true });
      return ch;
    });
    channelPromise.catch(() => {
      channelPromise = null;
    });
  }
  return channelPromise;
}

/** Enqueue an OCR job for background processing. Returns false if the broker is unreachable. */
export async function publishOcrJob(jobId: string): Promise<boolean> {
  try {
    const ch = await getChannel();
    ch.sendToQueue(OCR_QUEUE, Buffer.from(JSON.stringify({ jobId })), { persistent: true });
    return true;
  } catch (err) {
    console.warn('[Queue] RabbitMQ unreachable, cannot enqueue OCR job:', (err as Error)?.message);
    return false;
  }
}

/**
 * Start consuming OCR jobs. Safe to call multiple times — a globalThis guard
 * prevents duplicate consumers on Next.js dev reloads.
 */
export async function startOcrConsumer(): Promise<void> {
  const g = globalThis as any;
  if (g.__ocrConsumerStarted) return;
  g.__ocrConsumerStarted = true;

  try {
    const ch = await getChannel();
    ch.prefetch(1); // one OCR job at a time — tesseract workers are heavy

    await ch.consume(OCR_QUEUE, async (msg) => {
      if (!msg) return;
      let jobId = '';
      try {
        jobId = JSON.parse(msg.content.toString()).jobId;
        console.log(`[Queue] OCR job started: ${jobId}`);
        await connectDB();
        await runOcrJob(jobId);
        console.log(`[Queue] OCR job finished: ${jobId}`);
        ch.ack(msg);
      } catch (err: any) {
        console.error(`[Queue] OCR job failed: ${jobId}`, err?.message || err);
        try {
          await connectDB();
          await OcrJob.updateOne(
            { jobId },
            { $set: { status: 'failed', error: err?.message || 'Worker error', finishedAt: new Date() } }
          );
        } catch {}
        ch.ack(msg); // ack so the job isn't re-queued forever; retry via dashboard
      }
    });

    console.log(`[Queue] OCR consumer listening on "${OCR_QUEUE}" (${RABBITMQ_URL})`);
  } catch (err) {
    g.__ocrConsumerStarted = false;
    console.warn('[Queue] OCR consumer could not connect to RabbitMQ — background OCR disabled until restart:', (err as Error)?.message);
  }
}
