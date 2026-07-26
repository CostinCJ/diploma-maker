// tests/columns.test.js
import { describe, it, expect } from 'vitest';
import { findColumnRegions, estimateTextRows } from '../src/ocr/columns.js';

/** Build a white page and let `paint(set)` mark dark pixels. */
function page(w, h, paint) {
  const data = new Uint8ClampedArray(w * h * 4).fill(255);
  const set = (x, y) => {
    const i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 0;
    data[i + 3] = 255;
  };
  paint(set);
  return { data, width: w, height: h };
}

/** Rows of "text" spanning x0..x1, one band every `step` rows. */
const rows = (set, x0, x1, h, step = 4) => {
  for (let y = 2; y < h - 2; y += step) {
    for (let x = x0; x <= x1; x++) set(x, y);
  }
};

describe('findColumnRegions', () => {
  it('splits two text blocks separated by a blank gutter', () => {
    const img = page(100, 40, (set) => {
      rows(set, 5, 40, 40);   // left block
      rows(set, 60, 95, 40);  // right block, gutter at 41..59
    });
    const regions = findColumnRegions(img);
    expect(regions.length).toBe(2);
    expect(regions[0].x).toBe(0);
    expect(regions[0].width + regions[1].width).toBe(100);
    // The cut lands inside the gutter, not through either block.
    expect(regions[1].x).toBeGreaterThan(40);
    expect(regions[1].x).toBeLessThan(60);
  });

  it('returns one region for a single block of text', () => {
    const img = page(100, 40, (set) => rows(set, 5, 95, 40));
    expect(findColumnRegions(img)).toEqual([{ x: 0, width: 100 }]);
  });

  it('ignores page margins, which touch an edge', () => {
    // Wide blank margins either side, but a single text block in the middle.
    const img = page(100, 40, (set) => rows(set, 30, 70, 40));
    expect(findColumnRegions(img)).toEqual([{ x: 0, width: 100 }]);
  });

  it('does not split off a narrow sliver such as a vertical rule', () => {
    const img = page(100, 40, (set) => {
      for (let y = 0; y < 40; y++) set(2, y); // rule near the left edge
      rows(set, 20, 95, 40);
    });
    expect(findColumnRegions(img)).toEqual([{ x: 0, width: 100 }]);
  });

  it('returns one region for a blank page', () => {
    expect(findColumnRegions(page(50, 20, () => {}))).toEqual([{ x: 0, width: 50 }]);
  });

  it('handles a degenerate one-pixel-wide image', () => {
    expect(findColumnRegions(page(1, 10, () => {}))).toEqual([{ x: 0, width: 1 }]);
  });
});

describe('estimateTextRows', () => {
  it('counts bands of ink, not individual dark pixels', () => {
    // rows() paints while y < h-2, so bands land at y = 2, 6, 10, 14
    const img = page(40, 20, (set) => rows(set, 2, 38, 20));
    expect(estimateTextRows(img)).toBe(4);
  });

  it('returns 0 for a blank page', () => {
    expect(estimateTextRows(page(40, 20, () => {}))).toBe(0);
  });

  it('treats a multi-pixel-tall line as one row', () => {
    const img = page(40, 20, (set) => {
      for (let y = 5; y <= 8; y++) for (let x = 2; x < 38; x++) set(x, y);
    });
    expect(estimateTextRows(img)).toBe(1);
  });
});
