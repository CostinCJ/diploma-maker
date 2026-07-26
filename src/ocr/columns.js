// src/ocr/columns.js — pure page-geometry helpers (no DOM, no Electron).

const luminance = (d, i) => d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;

/** Fraction of dark pixels in each image column, left to right. */
function columnInk(imageData, threshold) {
  const { data, width: w, height: h } = imageData;
  const ink = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let dark = 0;
    for (let y = 0; y < h; y++) if (luminance(data, (y * w + x) * 4) < threshold) dark++;
    ink[x] = dark / h;
  }
  return ink;
}

/** Runs of consecutive indices where `values[i] <= maxValue`. */
function blankRuns(values, maxValue) {
  const runs = [];
  let start = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] <= maxValue) {
      if (start === null) start = i;
    } else if (start !== null) {
      runs.push([start, i - 1]);
      start = null;
    }
  }
  if (start !== null) runs.push([start, values.length - 1]);
  return runs;
}

/** Text columns of a light-background page, found from tall blank gutters.
 *  Returns [{ x, width }] left to right — a single full-width region when the
 *  page has no interior gutter. Page margins touch an edge and are ignored. */
export function findColumnRegions(imageData, options = {}) {
  const {
    threshold = 140,
    maxGutterInk = 0.02,
    minGutterWidth = 4,
    minColumnRatio = 0.15,
  } = options;
  const { width: w } = imageData;
  const full = [{ x: 0, width: w }];
  if (w < 2) return full;

  const gutters = blankRuns(columnInk(imageData, threshold), maxGutterInk)
    // A run touching either edge is a margin, not a separator between columns.
    .filter(([a, b]) => a > 0 && b < w - 1 && b - a + 1 >= minGutterWidth);
  if (!gutters.length) return full;

  const regions = [];
  let prev = 0;
  for (const cut of [...gutters.map(([a, b]) => Math.round((a + b) / 2)), w]) {
    // Skip slivers: a narrow strip is a rule or a stray mark, not a column.
    if (cut - prev >= w * minColumnRatio) regions.push({ x: prev, width: cut - prev });
    prev = cut;
  }
  return regions.length > 1 ? regions : full;
}

/** Rough count of text lines, from bands of ink in the horizontal projection.
 *  Used only as a target to judge whether an OCR pass did well enough. */
export function estimateTextRows(imageData, options = {}) {
  const { threshold = 140, minRowInk = 0.01 } = options;
  const { data, width: w, height: h } = imageData;
  let bands = 0;
  let inBand = false;
  for (let y = 0; y < h; y++) {
    let dark = 0;
    for (let x = 0; x < w; x++) if (luminance(data, (y * w + x) * 4) < threshold) dark++;
    const hasInk = dark / w > minRowInk;
    if (hasInk && !inBand) bands++;
    inBand = hasInk;
  }
  return bands;
}
