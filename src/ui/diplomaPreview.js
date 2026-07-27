// src/ui/diplomaPreview.js
// The pieces every on-screen diploma needs, so the three places that show one
// (session, templates, generate) render exactly what the printer will.
import { DIPLOMA_CSS } from '../shared/diplomaCss.js';
import { fileUrl } from '../shared/fileUrl.js';
import { formatDateRo } from '../shared/template.js';

/** Inject the diploma stylesheet once, whichever step asks for it first. */
export function ensureDiplomaCss() {
  if (document.getElementById('diploma-css')) return;
  const style = document.createElement('style');
  style.id = 'diploma-css';
  style.textContent = DIPLOMA_CSS;
  document.head.appendChild(style);
}

/** The session's images as the renderer wants them, including how strongly the
 *  group photo shows through. */
export const diplomaAssets = (session) => ({
  background: fileUrl(session.background),
  backgroundOpacity: session.backgroundOpacity,
  logoLeft: fileUrl(session.logoLeft),
  logoRight: fileUrl(session.logoRight),
});

/** Dates for a preview, standing in for dates that are not set yet. */
export const previewCtx = (session) => ({
  start: formatDateRo(session.startDate) || 'ZZ.LL.AAAA',
  end: formatDateRo(session.endDate) || 'ZZ.LL.AAAA',
});
