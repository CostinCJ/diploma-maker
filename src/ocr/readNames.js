// src/ocr/readNames.js — decides how to OCR a page.
//
// Tesseract's layout analysis is unstable on low-resolution lists: on a real
// 452x640 sample, the same column yielded 54 names at 3.0x scale, 1 name at
// 3.125x, and 55 again once contrast preprocessing was added. No fixed recipe
// wins, so instead of guessing we run a few configurations and keep whichever
// produced the most name-shaped rows. A bad pass is cheap to detect, which is
// what makes this work.
import { parseNamesFromOcrText } from '../shared/nameParsing.js';

/** Rows carrying at least a family name and a given name. The score used to
 *  compare OCR passes: junk passes produce single-token fragments. */
export function countFullNames(names) {
  return names.filter((n) => n.trim().split(/\s+/).length >= 2).length;
}

/** Stop escalating once a pass recovers this share of the expected rows. */
export const GOOD_ENOUGH = 0.6;

const better = (a, b) => (b.score > a.score ? b : a);

/**
 * @param prepared  { regions, expectedRows, render({region, enhance}) → data URL }
 * @param ocr       async (pngDataUrl) → recognised text
 * @param onProgress optional (label, attemptIndex) for status display
 * @returns { names, label, attempts }
 */
export async function readNamesFromImage(prepared, ocr, onProgress = () => {}) {
  const columns = prepared.regions.length > 1 ? prepared.regions : null;
  // Each column holds roughly expectedRows lines (rows of side-by-side columns
  // share the same horizontal bands), so a split page should yield that many
  // times the number of columns.
  const target = Math.max(1, prepared.expectedRows) * (columns ? columns.length : 1);
  let attempts = 0;

  async function attempt(label, parts) {
    attempts += 1;
    onProgress(label, attempts);
    let names = [];
    for (const part of parts) {
      const text = await ocr(await prepared.render(part));
      names = names.concat(parseNamesFromOcrText(text));
    }
    return { label, names, score: countFullNames(names) };
  }

  const whole = (enhance) => [{ region: null, enhance }];
  const perColumn = (enhance) => columns.map((region) => ({ region, enhance }));

  let best = await attempt('imaginea întreagă', whole(false));
  // Always worth trying: on a two-column list, splitting took the same sample
  // from 62 to 113 names, which the whole-page score alone would not reveal.
  if (columns) best = better(best, await attempt('pe coloane', perColumn(false)));

  if (best.score < target * GOOD_ENOUGH) {
    best = better(best, await attempt('imaginea întreagă, contrast mărit', whole(true)));
    if (columns) best = better(best, await attempt('pe coloane, contrast mărit', perColumn(true)));
  }

  return { names: best.names, label: best.label, attempts };
}
