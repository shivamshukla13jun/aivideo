/**
 * OCR Text Extraction Utility
 * Extracts dialogue and narration text from webtoon page images using Tesseract.js.
 * If OCR fails or detects no text, gracefully returns an empty string ("").
 */

import { createWorker } from 'tesseract.js';

export async function extractTextFromImage(imageInput: string | Buffer): Promise<string> {
  try {
    let inputToProcess = imageInput;

    // If it's a URL, fetch the image buffer to avoid CORS/network issues inside worker
    if (typeof imageInput === 'string' && (imageInput.startsWith('http://') || imageInput.startsWith('https://'))) {
      const res = await fetch(imageInput);
      if (!res.ok) {
        console.warn(`Failed to fetch image for OCR (${res.status}): ${imageInput}`);
        return '';
      }
      const arrayBuffer = await res.arrayBuffer();
      inputToProcess = Buffer.from(arrayBuffer);
    }

    const worker = await createWorker('eng');
    const ret = await worker.recognize(inputToProcess);
    await worker.terminate();

    const rawText = ret?.data?.text || '';

    // Clean up noisy OCR artifacts while preserving readable speech/narration
    const cleanedText = rawText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanedText;
  } catch (err) {
    console.warn('OCR extraction failed, keeping text empty:', err);
    return '';
  }
}
