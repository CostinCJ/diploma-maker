// src/ocr/preprocess.js
import { findColumnRegions, estimateTextRows } from './columns.js';

/** In-place grayscale + full-range contrast stretch on an ImageData-like {data}. */
export function grayscaleContrastStretch(imageData) {
  const d = imageData.data;
  const n = d.length / 4;
  const gray = new Uint8Array(n);
  let min = 255, max = 0;
  for (let i = 0; i < n; i++) {
    const g = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
    gray[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < n; i++) {
    const v = Math.round(((gray[i] - min) * 255) / range);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  return imageData;
}

/** In-place adaptive mean thresholding on an already-grayscaled ImageData-like
 *  {data, width, height} (reads the red channel). Each pixel is compared with the
 *  mean of its local window: darker than mean - c → black, else white. Unlike a
 *  global stretch, this survives uneven lighting (curved or folded pages). */
export function adaptiveThreshold(imageData, c = 10) {
  const { data: d, width: w, height: h } = imageData;
  const n = w * h;
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) gray[i] = d[i * 4];
  // Summed-area table for O(1) window means.
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += gray[y * w + x];
      integral[(y + 1) * (w + 1) + (x + 1)] = integral[y * (w + 1) + (x + 1)] + rowSum;
    }
  }
  const win = Math.max(15, Math.round(Math.min(w, h) / 16) | 1);
  const r = win >> 1;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r);
      const area = (y1 - y0 + 1) * (x1 - x0 + 1);
      const sum = integral[(y1 + 1) * (w + 1) + (x1 + 1)] - integral[y0 * (w + 1) + (x1 + 1)]
                - integral[(y1 + 1) * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const v = gray[y * w + x] < sum / area - c ? 0 : 255;
      const i4 = (y * w + x) * 4;
      d[i4] = d[i4 + 1] = d[i4 + 2] = v;
      d[i4 + 3] = 255;
    }
  }
  return imageData;
}

// Tesseract wants roughly 30px of cap height. A phone photo has far more than
// that and only needs capping; a small scan or screenshot has far less and must
// be enlarged — the previous Math.min(1, …) only ever shrank, so a 452x640
// list was fed in at ~6px per line and read as gibberish.
export const TARGET_LONG_EDGE = 2000;
export const MAX_LONG_EDGE = 3000;
export const MAX_UPSCALE = 4;

/** Scale factor to bring an image into the size band Tesseract reads best. */
export function computeScale(width, height) {
  const longEdge = Math.max(width, height);
  if (!longEdge) return 1;
  if (longEdge < TARGET_LONG_EDGE) return Math.min(MAX_UPSCALE, TARGET_LONG_EDGE / longEdge);
  if (longEdge > MAX_LONG_EDGE) return MAX_LONG_EDGE / longEdge;
  return 1;
}

/** Browser-only: decode a File and expose it for repeated OCR attempts.
 *  Returns { width, height, regions, expectedRows, render(part) } where
 *  `render({ region, enhance })` produces a PNG data URL for one attempt.
 *  Throws if the file is not a decodable image. */
export async function prepareImageFile(file) {
  const url = URL.createObjectURL(file);
  let img;
  try {
    img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Fișierul nu este o imagine validă: ' + file.name));
      i.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  // Analyse the page at its natural size: geometry is what matters here, and
  // upscaling first would only cost memory.
  const base = document.createElement('canvas');
  base.width = img.width;
  base.height = img.height;
  const baseCtx = base.getContext('2d', { willReadFrequently: true });
  baseCtx.drawImage(img, 0, 0);
  const pixels = baseCtx.getImageData(0, 0, img.width, img.height);

  return {
    width: img.width,
    height: img.height,
    regions: findColumnRegions(pixels),
    expectedRows: estimateTextRows(pixels),
    /** @param part { region: {x,width}|null, enhance: boolean } */
    render({ region = null, enhance = false } = {}) {
      const sx = region ? region.x : 0;
      const sw = region ? region.width : img.width;
      const scale = computeScale(sw, img.height);
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, sx, 0, sw, img.height, 0, 0, w, h);
      if (enhance) {
        // Only on request: binarising a clean scan destroys it (9 names vs 62
        // on the sample), but it rescues low-contrast and unevenly lit pages.
        const data = ctx.getImageData(0, 0, w, h);
        grayscaleContrastStretch(data);
        adaptiveThreshold(data);
        ctx.putImageData(data, 0, 0);
      }
      return canvas.toDataURL('image/png');
    },
  };
}
