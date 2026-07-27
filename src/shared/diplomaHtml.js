// src/shared/diplomaHtml.js
import { fillLine, DEFAULT_LINE_STYLES, MIN_LINE_SIZE, MAX_LINE_SIZE } from './template.js';
import { DIPLOMA_CSS } from './diplomaCss.js';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function img(cls, src, style = '') {
  return src ? `<img class="${cls}" src="${esc(src)}"${style ? ` style="${esc(style)}"` : ''} alt="" />` : '';
}

/** The group photo sits behind the text, so how strongly it shows through is a
 *  per-session choice — a dark photo needs a lighter hand than a pale one. The
 *  stylesheet only provides the fallback for a session that has no preference. */
function backgroundStyle(opacity) {
  const value = Number(opacity);
  return Number.isFinite(value) ? `opacity:${Math.min(1, Math.max(0, value))}` : '';
}

/** How one line was set, as an attribute — and only where the guide moved away
 *  from the stylesheet. A line left as it always was carries no style at all,
 *  so an untouched diploma prints byte for byte what it printed before. */
function lineStyle(styles, slot) {
  const base = DEFAULT_LINE_STYLES[slot];
  const chosen = styles?.[slot] ?? {};
  const size = Number(chosen.size);
  const out = [];
  if (Number.isFinite(size) && Math.round(size) !== base.size) {
    out.push(`font-size:${Math.min(MAX_LINE_SIZE, Math.max(MIN_LINE_SIZE, Math.round(size)))}pt`);
  }
  if (typeof chosen.bold === 'boolean' && chosen.bold !== base.bold) {
    out.push(`font-weight:${chosen.bold ? 'bold' : 'normal'}`);
  }
  if (typeof chosen.italic === 'boolean' && chosen.italic !== base.italic) {
    out.push(`font-style:${chosen.italic ? 'italic' : 'normal'}`);
  }
  return out.length ? ` style="${esc(out.join(';'))}"` : '';
}

/** One diploma as an HTML fragment. `assets` values are file:// URLs (or ''). */
export function renderDiplomaHtml(tpl, name, ctx, assets) {
  const st = (slot) => lineStyle(tpl.styles, slot);
  return `<div class="diploma">
  ${img('bg', assets.background, backgroundStyle(assets.backgroundOpacity))}
  ${img('logo left', assets.logoLeft)}
  ${img('logo right', assets.logoRight)}
  <div class="content">
    <h1${st('title')}>${esc(tpl.title)}</h1>
    <p class="award"${st('award')}>${esc(fillLine(tpl.awardLine, ctx))}</p>
    <p class="name"${st('name')}>${esc(name)}</p>
    <p class="part"${st('part')}>${esc(fillLine(tpl.participationLine, ctx))}</p>
    <p class="dates"${st('dates')}>${esc(fillLine(tpl.dateLine, ctx))}</p>
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
