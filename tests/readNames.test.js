// tests/readNames.test.js
import { describe, it, expect } from 'vitest';
import { readNamesFromImage, countFullNames, GOOD_ENOUGH } from '../src/ocr/readNames.js';

/** A stub page. `texts` maps an attempt key to the text the fake OCR returns.
 *  Keys are `whole:plain`, `whole:enhanced`, `col0:plain`, `col1:enhanced`, … */
function stubPage({ columns = 1, expectedRows = 10, texts = {} }) {
  const regions = Array.from({ length: columns }, (_, i) => ({ x: i, width: 10 }));
  const calls = [];
  const prepared = {
    regions,
    expectedRows,
    render({ region, enhance }) {
      const which = region ? `col${regions.indexOf(region)}` : 'whole';
      return `${which}:${enhance ? 'enhanced' : 'plain'}`;
    },
  };
  const ocr = async (key) => {
    calls.push(key);
    return texts[key] ?? '';
  };
  return { prepared, ocr, calls };
}

const list = (n, prefix = 'POPESCU') =>
  Array.from({ length: n }, (_, i) => `${prefix} NUME${i}`).join('\n');

describe('countFullNames', () => {
  it('counts only rows with at least two words', () => {
    expect(countFullNames(['POPESCU ANA', 'FRAGMENT', 'IONESCU DAN MIHAI'])).toBe(2);
  });
  it('is not fooled by extra whitespace', () => {
    expect(countFullNames(['  POPESCU   ANA  ', ' SINGLE '])).toBe(1);
  });
});

describe('readNamesFromImage', () => {
  it('uses the whole page when one pass already reads it well', async () => {
    const { prepared, ocr, calls } = stubPage({
      expectedRows: 10,
      texts: { 'whole:plain': list(10) },
    });
    const out = await readNamesFromImage(prepared, ocr);
    expect(out.names.length).toBe(10);
    expect(out.attempts).toBe(1);
    expect(calls).toEqual(['whole:plain']); // no needless extra OCR passes
  });

  it('prefers per-column reading when it recovers more names', async () => {
    // Whole-page reads one column's worth; splitting reads both.
    const { prepared, ocr } = stubPage({
      columns: 2,
      expectedRows: 10,
      texts: {
        'whole:plain': list(10, 'WHOLE'),
        'col0:plain': list(10, 'LEFT'),
        'col1:plain': list(10, 'RIGHT'),
      },
    });
    const out = await readNamesFromImage(prepared, ocr);
    expect(out.names.length).toBe(20);
    expect(out.label).toBe('pe coloane');
  });

  it('always tries splitting, even when the whole page looks good enough', async () => {
    // Whole page clears the threshold on its own, but splitting is still better.
    const { prepared, ocr, calls } = stubPage({
      columns: 2,
      expectedRows: 10,
      texts: {
        'whole:plain': list(18),
        'col0:plain': list(10, 'LEFT'),
        'col1:plain': list(10, 'RIGHT'),
      },
    });
    const out = await readNamesFromImage(prepared, ocr);
    expect(calls).toContain('col0:plain');
    expect(out.names.length).toBe(20);
  });

  it('escalates to contrast enhancement when results are poor', async () => {
    const { prepared, ocr, calls } = stubPage({
      expectedRows: 10,
      texts: { 'whole:plain': list(1), 'whole:enhanced': list(9) },
    });
    const out = await readNamesFromImage(prepared, ocr);
    expect(calls).toEqual(['whole:plain', 'whole:enhanced']);
    expect(out.names.length).toBe(9);
    expect(out.label).toBe('imaginea întreagă, contrast mărit');
  });

  it('keeps the plain pass when enhancement makes things worse', async () => {
    // Mirrors the real sample: binarising a clean scan destroyed the text.
    const { prepared, ocr } = stubPage({
      expectedRows: 100,
      texts: { 'whole:plain': list(62), 'whole:enhanced': list(9) },
    });
    const out = await readNamesFromImage(prepared, ocr);
    expect(out.names.length).toBe(62);
    expect(out.label).toBe('imaginea întreagă');
  });

  it('does not escalate once the good-enough share is reached', async () => {
    const rows = 10;
    const enough = Math.ceil(rows * GOOD_ENOUGH);
    const { prepared, ocr, calls } = stubPage({
      expectedRows: rows,
      texts: { 'whole:plain': list(enough) },
    });
    await readNamesFromImage(prepared, ocr);
    expect(calls).toEqual(['whole:plain']);
  });

  it('reports progress for each attempt', async () => {
    const { prepared, ocr } = stubPage({
      expectedRows: 10,
      texts: { 'whole:plain': list(1), 'whole:enhanced': list(1) },
    });
    const seen = [];
    await readNamesFromImage(prepared, ocr, (label, n) => seen.push([label, n]));
    expect(seen.map(([, n]) => n)).toEqual([1, 2]);
    expect(seen[0][0]).toBe('imaginea întreagă');
  });

  it('returns no names when every attempt reads nothing', async () => {
    const { prepared, ocr } = stubPage({ expectedRows: 10, texts: {} });
    const out = await readNamesFromImage(prepared, ocr);
    expect(out.names).toEqual([]);
  });
});
