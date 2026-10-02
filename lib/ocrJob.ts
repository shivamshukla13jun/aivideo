/**
 * OCR background job runner.
 * Extracts text (English + Hindi) for every page of a chapter with the job's
 * OCR provider, saves it on the Page document
 * (keyed by pageId = `${chapterId}_page_${order}`), refreshes generic scene
 * narrations, and records per-page progress on the OcrJob document so the
 * dashboard can show live status and retry failures.
 */

import { connectDB } from '@/lib/mongodb';
import { Page } from '@/models/Page';
import { Scene } from '@/models/Scene';
import { OcrJob } from '@/models/OcrJob';
import { getChapterPages } from '@/lib/suwayomi';
import { extractPageText, isProviderAvailable, type OcrProvider } from '@/lib/ocr';

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
  const provider: OcrProvider = isProviderAvailable(job.provider) ? (job.provider as OcrProvider) : 'tesseract';
  const overwrite = Boolean(job.overwriteScenes);

  for (let idx = 0; idx < pages.length; idx++) {
    const order = idx + 1;
    if (retryOnly && !retryOnly.has(order)) continue;

    const pageUrl = pages[idx];
    const pageId = `${chapterId}_page_${order}`;

    try {
      // Provider errors (quota, network) fail the page so it can be retried
      const ocr = await extractPageText(pageUrl, provider);

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
            extractedText: ocr.en,
            extractedTextHi: ocr.hi,
            ocrRaw: ocr.raw,
            ocrProvider: ocr.provider,
            status: 'active',
          },
          $setOnInsert: { panels: [] },
        },
        { upsert: true, new: true }
      );

      // Scenes reference a page by its Mongo id, or by the Suwayomi index id (0-based) when created before OCR
      const pageScenes = await Scene.find({
        chapterId,
        pageId: { $in: [String(pageDoc._id), `${chapterId}_page_${idx}`] },
      }).sort({ order: 1 });

      // Only the first scene of a page carries its narration; split continuations keep their own text
      const first = pageScenes[0];
      if (first) {
        const generic = !first.narration || first.narration.startsWith('Narration for Page');
        if (overwrite || generic) first.narration = ocr.en;
        if (overwrite || !first.narrationHi) first.narrationHi = ocr.hi;
        await first.save();
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
