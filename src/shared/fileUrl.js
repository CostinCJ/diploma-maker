// src/shared/fileUrl.js

/** Absolute path → file:// URL usable in <img src>.
 *  Kept out of renderer.js so it stays importable (and testable) without a DOM.
 *  encodeURI leaves '#' and '?' untouched, but in a URL they start a fragment or
 *  query and would truncate the path, so they are escaped explicitly. */
export function fileUrl(p) {
  if (!p) return '';
  const slashed = p.replace(/\\/g, '/');
  const abs = slashed.startsWith('/') ? slashed : '/' + slashed; // 'C:/x' → '/C:/x'
  return 'file://' + encodeURI(abs).replace(/#/g, '%23').replace(/\?/g, '%3F');
}
