import { connectDB } from '@/lib/mongodb';
import { OcrJob } from '@/models/OcrJob';
import { Chapter } from '@/models/Chapter';
import { Page } from '@/models/Page';
import { Scene } from '@/models/Scene';
import { getFileBuffer, uploadFile, deleteFiles } from '@/lib/minio';
import { extractPageTextEn, translateText } from '@/lib/ocr';

const paddleUrl = () =>
  (process.env.PADDLEOCR_URL || 'http://localhost:5004').replace(/\/+$/, '');

/**
 * Send one page image through the OCR server's /preprocess endpoint and store
 * the result back as a `_processed` object that replaces the original.
 */
async function preprocessPage(page: any, chapterId: string): Promise<void> {
  const objectKey = page.publicId;
  if (!objectKey) throw new Error('no image object key');

  const buf = await getFileBuffer(objectKey);
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(buf)], { type: 'application/octet-stream' }), 'page.png');
  const res = await fetch(`${paddleUrl()}/preprocess`, {
    method: 'POST',
    body: fd,
    // CPU image cleanup on big pages can take a while
    signal: AbortSignal.timeout(600_000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `preprocess HTTP ${res.status}`);
  }

  const processedBuf = Buffer.from(await res.arrayBuffer());
  const baseKey = objectKey.replace(/_processed(\.[^.]+)$/, '$1');
  const editedKey = baseKey.replace(/(\.[^.]+)$/, '_processed.png');
  const stored = await uploadFile(processedBuf, editedKey);

  const oldUrls = [page.originalUrl, page.editedUrl].filter((u): u is string => Boolean(u));
  await Page.findByIdAndUpdate(page._id, {
    $set: {
      originalUrl: stored.url,
      editedUrl: stored.url,
      publicId: editedKey,
      processedKey: editedKey,
    },
  });
  if (oldUrls.length) {
    await Scene.updateMany(
      { chapterId, image: { $in: oldUrls } },
      { $set: { image: stored.url } }
    );
  }
  const staleKeys = new Set([objectKey, page.processedKey].filter((k): k is string => Boolean(k)));
  staleKeys.delete(editedKey);
  if (staleKeys.size) await deleteFiles([...staleKeys]);
}

/**
 * Runs an OcrJob document to completion.
 * - stage 'preprocess': clean page images via the OCR server → replaces originals in MinIO
 * - stage 'extract':    PaddleOCR each page → Page.extractedText/ocrRaw + first-scene narration
 * - stage 'translate':  Page.extractedText → AI → Page.extractedTextHi + first-scene narrationHi
 *
 * Resumable by default: pages that already have the stage's output are skipped,
 * so restarting after a reload only processes what's still pending.
 * `overwriteScenes` = re-run everything; `failedOrders` retry = failed pages only.
 */
export async function runOcrJob(jobId: string) {
  await connectDB();
  const job = await OcrJob.findOne({ jobId });
  if (!job) throw new Error(`OcrJob ${jobId} not found`);

  const stage: 'extract' | 'translate' | 'preprocess' =
    job.stage === 'translate' ? 'translate' : job.stage === 'preprocess' ? 'preprocess' : 'extract';

  job.status = 'running';
  job.attempts += 1;
  job.startedAt = new Date();
  job.error = '';
  await job.save();

  try {
    const chapter = await Chapter.findById(job.chapterId);
    if (!chapter) throw new Error(`Chapter ${job.chapterId} not found`);

    const pages: any[] = await Page.find({ chapterId: job.chapterId, status: { $ne: 'deleted' } })
      .sort({ order: 1 })
      .lean();

    const overwrite = job.overwriteScenes;
    // Retries only re-process the orders that previously failed.
    const retryOnly = job.failedOrders && job.failedOrders.length > 0 ? new Set(job.failedOrders) : null;

    // Translate only applies to pages that actually have extracted text;
    // preprocess/extract run on every page.
    const eligible = stage === 'translate'
      ? pages.filter((p) => ((p as any).extractedText || '').trim())
      : pages;

    const isPending = (p: any) =>
      stage === 'extract'
        ? !p.ocrProvider
        : stage === 'preprocess'
          ? !p.processedKey
          : !(p.extractedTextHi || '').trim();

    // totalPages = what this run will actually process, so progress reads "done/pending"
    if (!retryOnly) {
      job.totalPages = overwrite ? eligible.length : eligible.filter(isPending).length;
      job.donePages = 0;
    }
    await job.save();

    const failedOrders: number[] = [];
    let done = 0;

    for (let idx = 0; idx < eligible.length; idx++) {
      const p = eligible[idx];
      const order = p.order ?? idx + 1;

      if (retryOnly && !retryOnly.has(order)) continue;
      if (!retryOnly && !overwrite && !isPending(p)) continue;

      try {
        if (stage === 'preprocess') {
          await preprocessPage(p, job.chapterId);
          done++;
          job.donePages = done;
          job.failedOrders = failedOrders;
          await job.save();
          continue;
        }

        const first: any = await Scene.findOne({ chapterId: job.chapterId, 'meta.pageOrders': order })
          .sort({ order: 1 })
          .lean();

        if (stage === 'extract') {
          const key = p.processedKey || p.publicId;
          const input = key ? await getFileBuffer(key) : p.originalUrl || p.editedUrl;
          const ocr = await extractPageTextEn(input, job.provider as any);

          await Page.findByIdAndUpdate(p._id, {
            $set: {
              extractedText: ocr.en,
              ocrRaw: ocr.raw,
              ocrProvider: ocr.provider,
            },
          });
          if (first) {
            const cur = await Scene.findById(first._id);
            if (cur) {
              const generic = !cur.narration || cur.narration === `Scene ${cur.order + 1}`;
              if (overwrite || generic) cur.narration = ocr.en;
              await cur.save();
            }
          }
        } else {
          const en = (p.extractedText || '').trim();
          const hi = await translateText(en, 'hi');
          if (!hi) throw new Error('Translation returned empty text');

          await Page.findByIdAndUpdate(p._id, {
            $set: { extractedTextHi: hi },
          });
          if (first) {
            const cur = await Scene.findById(first._id);
            if (cur && (overwrite || !cur.narrationHi)) {
              cur.narrationHi = hi;
              await cur.save();
            }
          }
        }
        done++;
      } catch (e: any) {
        failedOrders.push(order);
        console.warn(`[OCR] Page ${order} ${stage} failed:`, e?.message || e);
      }

      job.donePages = done;
      job.failedOrders = failedOrders;
      await job.save();
    }

    job.finishedAt = new Date();
    job.failedOrders = failedOrders;
    job.donePages = done;
    if (failedOrders.length > 0) {
      job.status = 'failed';
      job.error = `${failedOrders.length} page(s) failed ${stage}`;
    } else {
      job.status = 'done';
      job.error = '';
    }
    await job.save();

    return { done, failed: failedOrders.length, failedOrders };
  } catch (err: any) {
    job.status = 'failed';
    job.error = err?.message || 'OCR job failed';
    job.finishedAt = new Date();
    await job.save();
    throw err;
  }
}
