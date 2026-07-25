// src/shared/diplomaHtml.js
import { fillLine } from './template.js';
import { DIPLOMA_CSS } from './diplomaCss.js';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function img(cls, src) {
  return src ? `<img class="${cls}" src="${esc(src)}" alt="" />` : '';
}

/** One diploma as an HTML fragment. `assets` values are file:// URLs (or ''). */
export function renderDiplomaHtml(tpl, name, ctx, assets) {
  return `<div class="diploma">
  ${img('bg', assets.background)}
  ${img('logo left', assets.logoLeft)}
  ${img('logo right', assets.logoRight)}
  <div class="content">
    <h1>${esc(tpl.title)}</h1>
    <p class="award">${esc(fillLine(tpl.awardLine, ctx))}</p>
    <p class="name">${esc(name)}</p>
    <p class="part">${esc(fillLine(tpl.participationLine, ctx))}</p>
    <p class="dates">${esc(fillLine(tpl.dateLine, ctx))}</p>
  </div>
</div>`;
}

/** Full standalone HTML document for printing/PDF: one diploma per page. */
export function buildPrintDocument(diplomaFragments) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>${DIPLOMA_CSS}
body { margin: 0; }</style></head>
<body>${diplomaFragments.join('\n')}</body></html>`;
}
