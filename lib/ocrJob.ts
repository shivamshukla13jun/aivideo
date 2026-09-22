/**
 * OCR background job runner.
 * Extracts text for every page of a chapter, saves it on the Page document
 * (keyed by pageId = `${chapterId}_page_${order}`), refreshes generic scene
 * narrations, and records per-page progress on the OcrJob document so the
 * dashboard can show live status and retry failures.
 */

import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';
import { Scene } from '@/models/Scene';
import { OcrJob } from '@/models/OcrJob';
import { getChapterPages } from '@/lib/suwayomi';
import { extractTextFromImage } from '@/lib/ocr';

export interface OcrJobResult {
  total: number;
  done: number;
  failedOrders: number[];
}

export async function runOcrJob(jobId: string): Promise<OcrJobResult> {
  await connectDB();

  const job = await OcrJob.findOne({ jobId });
  if (!job) throw new Error(`OCR job not found: ${jobId}`);

  const chapterId = job.chapterId;
  const numericId = parseInt(chapterId, 10);
  if (isNaN(numericId)) throw new Error(`Invalid chapter id: ${chapterId}`);

  job.status = 'running';
  job.startedAt = new Date();
  job.finishedAt = undefined;
  job.error = '';
  job.attempts = (job.attempts || 0) + 1;
  await job.save();

  const { pages } = await getChapterPages(numericId);

  // On retry, only re-process pages that previously failed
  const retryOnly = job.failedOrders && job.failedOrders.length > 0 ? new Set(job.failedOrders) : null;
  if (retryOnly === null) {
    job.totalPages = pages.length;
    job.donePages = 0;
    job.failedOrders = [];
    await job.save();
  }

  const failedOrders: number[] = [];

  for (let idx = 0; idx < pages.length; idx++) {
    const order = idx + 1;
    if (retryOnly && !retryOnly.has(order)) continue;

    const pageUrl = pages[idx];
    const pageId = `${chapterId}_page_${order}`;

    try {
      let extractedText = '';
      try {
        extractedText = await extractTextFromImage(pageUrl);
      } catch (ocrErr) {
        console.warn(`[OCR Job ${jobId}] OCR failed for page ${order}:`, ocrErr);
        extractedText = '';
      }

      // Upsert the Page document — extracted text is stored via pageId
      const pageDoc = await Page.findOneAndUpdate(
        { chapterId, order },
        {
          $set: {
            chapterId,
            pageId,
            order,
            originalUrl: pageUrl,
            editedUrl: pageUrl,
            extractedText: extractedText || '',
            status: 'active',
          },
          $setOnInsert: { panels: [] },
        },
        { upsert: true, new: true }
      );

      // Refresh generic/empty scene narrations for this page
      const existingScenes = await Scene.find({
        chapterId,
        $or: [{ pageId }, { pageId: String(pageDoc._id) }, { order }],
      });
      for (const scene of existingScenes) {
        if (!scene.narration || scene.narration.startsWith('Narration for Page')) {
          scene.narration = extractedText || '';
          await scene.save();
        }
      }

      await OcrJob.updateOne({ jobId }, { $inc: { donePages: 1 }, $pull: { failedOrders: order } });
    } catch (pageErr: any) {
      console.warn(`[OCR Job ${jobId}] Page ${order} failed:`, pageErr?.message || pageErr);
      failedOrders.push(order);
      await OcrJob.updateOne({ jobId }, { $addToSet: { failedOrders: order } });
    }
  }

  const fresh = await OcrJob.findOne({ jobId });
  const remainingFailed = fresh?.failedOrders?.length || 0;
  const total = fresh?.totalPages || pages.length;
  const done = fresh?.donePages || 0;
  const completedAll = retryOnly ? remainingFailed === 0 : done + remainingFailed >= total;

  await OcrJob.updateOne(
    { jobId },
    {
      $set: {
        status: completedAll ? 'done' : 'failed',
        finishedAt: new Date(),
        error: completedAll ? '' : `${remainingFailed} page(s) failed OCR`,
      },
    }
  );

  return { total, done, failedOrders };
}
