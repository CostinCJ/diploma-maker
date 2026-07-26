import { describe, it, expect } from 'vitest';
import { grayscaleContrastStretch, adaptiveThreshold, computeScale } from '../src/ocr/preprocess.js';

function px(...rgbas) { return { data: new Uint8ClampedArray(rgbas.flat()) }; }

describe('grayscaleContrastStretch', () => {
  it('stretches darkest pixel to 0 and brightest to 255, output is gray', () => {
    // two pixels: mid-dark gray (100,100,100) and light gray (200,200,200)
    const img = px([100, 100, 100, 255], [200, 200, 200, 255]);
    grayscaleContrastStretch(img);
    expect([img.data[0], img.data[1], img.data[2]]).toEqual([0, 0, 0]);
    expect([img.data[4], img.data[5], img.data[6]]).toEqual([255, 255, 255]);
  });

  it('handles flat images without dividing by zero', () => {
    const img = px([128, 128, 128, 255], [128, 128, 128, 255]);
    grayscaleContrastStretch(img);
    expect(img.data[0]).toBe(0); // (128-128)*255/1 = 0; no NaN
  });
});

describe('adaptiveThreshold', () => {
  it('separates dark marks from background on both bright and dark regions of a gradient', () => {
    // 16x16 grayscale gradient: left column value 100 → right column value 200,
    // with two dark dots (value 20) at (4,8) and (12,8).
    const w = 16, h = 16;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = Math.round(100 + (100 * x) / (w - 1));
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    for (const dx of [4, 12]) {
      const i = (8 * w + dx) * 4;
      data[i] = data[i + 1] = data[i + 2] = 20;
    }
    const img = { data, width: w, height: h };
    adaptiveThreshold(img);
    const px = (x, y) => data[(y * w + x) * 4];
    expect(px(4, 8)).toBe(0);    // dark dot on the darker side → black
    expect(px(12, 8)).toBe(0);   // dark dot on the brighter side → black
    expect(px(4, 2)).toBe(255);  // background near dark side → white
    expect(px(12, 2)).toBe(255); // background near bright side → white
  });
});

describe('computeScale', () => {
  it('enlarges a small screenshot so text is big enough to read', () => {
    // The real failing sample: 452x640 was fed to Tesseract untouched.
    expect(computeScale(452, 640)).toBeCloseTo(2000 / 640, 5);
  });

  it('caps upscaling so a tiny image cannot explode in memory', () => {
    expect(computeScale(50, 50)).toBe(4);
  });

  it('shrinks an oversized phone photo', () => {
    expect(computeScale(4000, 3000)).toBeCloseTo(3000 / 4000, 5);
  });

  it('leaves an image already in the good band alone', () => {
    expect(computeScale(2500, 1800)).toBe(1);
  });

  it('is driven by the long edge, not the width', () => {
    expect(computeScale(640, 452)).toBeCloseTo(2000 / 640, 5);
  });

  it('survives a zero-sized image', () => {
    expect(computeScale(0, 0)).toBe(1);
  });
});
