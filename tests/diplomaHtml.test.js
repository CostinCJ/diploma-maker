// tests/diplomaHtml.test.js
import { describe, it, expect } from 'vitest';
import { renderDiplomaHtml, buildPrintDocument } from '../src/shared/diplomaHtml.js';
import { DEFAULT_TEMPLATES, DEFAULT_LINE_STYLES } from '../src/shared/template.js';

const CTX = { start: '07.07.2026', end: '12.07.2026' };
const ASSETS = { background: 'file:///C:/x/bg.jpg', logoLeft: 'file:///C:/x/l.png', logoRight: 'file:///C:/x/r.png' };

describe('renderDiplomaHtml', () => {
  it('contains name, filled date line and all template lines', () => {
    const html = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'PĂUNESCU ȘTEFAN', CTX, ASSETS);
    expect(html).toContain('PĂUNESCU ȘTEFAN');
    expect(html).toContain('în perioada 07.07.2026 - 12.07.2026');
    expect(html).toContain('Diplomă de participare');
    expect(html).toContain('SE ACORDĂ ELEVULUI/ELEVEI');
    expect(html).toContain(ASSETS.background);
  });

  it('escapes HTML in names', () => {
    const html = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, '<b>X</b>', CTX, ASSETS);
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
  });

  it('escapes quotes in asset URLs so attributes cannot be broken', () => {
    const html = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'A B', CTX, { background: 'file:///x".jpg" onerror="evil()', logoLeft: '', logoRight: '' });
    expect(html).not.toContain('onerror="evil()"');
    expect(html).toContain('&quot;');
  });

  it('renders the chosen strength of the group photo', () => {
    const html = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'A B', CTX, { ...ASSETS, backgroundOpacity: 0.2 });
    expect(html).toContain('style="opacity:0.2"');
  });

  it('clamps a strength outside 0–1 instead of emitting it', () => {
    for (const [given, expected] of [[2, 1], [-1, 0]]) {
      expect(renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'A B', CTX, { ...ASSETS, backgroundOpacity: given }))
        .toContain(`style="opacity:${expected}"`);
    }
  });

  // The stylesheet still carries the value every diploma used before this was
  // a choice, so a caller that does not pass one renders exactly as before.
  it('leaves the stylesheet in charge when no strength is given', () => {
    expect(renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'A B', CTX, ASSETS)).not.toContain('style=');
  });

  const styled = (slot, style) => ({
    ...DEFAULT_TEMPLATES.kid,
    styles: { ...DEFAULT_TEMPLATES.kid.styles, [slot]: { ...DEFAULT_LINE_STYLES[slot], ...style } },
  });

  it('writes the chosen size, bold and italic onto the line they belong to', () => {
    const html = renderDiplomaHtml(styled('title', { size: 52, italic: true }), 'A B', CTX, ASSETS);
    expect(html).toContain('<h1 style="font-size:52pt;font-style:italic">');
    expect(html).toContain('<p class="award">'); // the other lines are untouched
  });

  it('turns off what the stylesheet turns on', () => {
    expect(renderDiplomaHtml(styled('part', { italic: false }), 'A B', CTX, ASSETS))
      .toContain('<p class="part" style="font-style:normal">');
    expect(renderDiplomaHtml(styled('name', { bold: false }), 'A B', CTX, ASSETS))
      .toContain('<p class="name" style="font-weight:normal">');
  });

  it('styles the name line, whose text comes from the list', () => {
    expect(renderDiplomaHtml(styled('name', { size: 34 }), 'A B', CTX, ASSETS))
      .toContain('<p class="name" style="font-size:34pt">A B</p>');
  });

  // The stylesheet stays in charge of anything the guide left alone, so a
  // session that never opened the templates step prints exactly as before.
  it('writes nothing for lines left as the stylesheet has them', () => {
    expect(renderDiplomaHtml(styled('dates', { size: 14 }), 'A B', CTX, ASSETS))
      .not.toContain('style=');
  });

  it('clamps a size outside the allowed range', () => {
    expect(renderDiplomaHtml(styled('dates', { size: 500 }), 'A B', CTX, ASSETS))
      .toContain('font-size:80pt');
    expect(renderDiplomaHtml(styled('dates', { size: 1 }), 'A B', CTX, ASSETS))
      .toContain('font-size:8pt');
  });

  it('ignores a template with no styles at all', () => {
    const { styles, ...noStyles } = DEFAULT_TEMPLATES.kid;
    expect(renderDiplomaHtml(noStyles, 'A B', CTX, ASSETS)).not.toContain('style=');
  });

  it('omits image tags for missing assets', () => {
    const html = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'A B', CTX, { background: '', logoLeft: '', logoRight: '' });
    expect(html).not.toContain('<img');
  });
});

describe('buildPrintDocument', () => {
  it('wraps diplomas in a full HTML document with the diploma CSS', () => {
    const one = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'A B', CTX, ASSETS);
    const doc = buildPrintDocument([one]);
    expect(doc).toContain('<!DOCTYPE html>');
    expect(doc).toContain('.diploma');
    expect(doc).toContain('A B');
  });
});
