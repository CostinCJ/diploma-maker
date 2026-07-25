// tests/diplomaHtml.test.js
import { describe, it, expect } from 'vitest';
import { renderDiplomaHtml, buildPrintDocument } from '../src/shared/diplomaHtml.js';
import { DEFAULT_TEMPLATES } from '../src/shared/template.js';

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
