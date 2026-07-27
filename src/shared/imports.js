// src/shared/imports.js
// A session remembers where each name came from, so a wrong photo or the wrong
// file can be taken back out on its own — without clearing the session and
// starting over, and without hunting for its names among the corrected ones.
// Rows the guide typed by hand belong to no import and are never touched.

const NO_IMPORT = '';

/** Register a source before its names are known. Photos are registered as soon
 *  as they are read, so a photo whose names were all rejected is still listed
 *  (and still removable) instead of sitting there unaccounted for. */
export function registerImport(session, { label, kind, photo = '' }, id = crypto.randomUUID()) {
  return { id, imports: [...session.imports, { id, label, kind, photo }] };
}

export function appendNames(session, id, names) {
  return [...session.kids, ...names.map((name) => ({ name, importId: id }))];
}

/** Drop a source and every name still carried from it. */
export function removeImport(session, id) {
  return {
    kids: session.kids.filter((kid) => kid.importId !== id),
    imports: session.imports.filter((entry) => entry.id !== id),
  };
}

/** How many of an import's names are still in the list — rows deleted by hand
 *  are already gone, and that is the number worth showing. */
export const countFromImport = (kids, id) => kids.filter((kid) => kid.importId === id).length;

/** Names typed by hand rather than imported. */
export const typedNames = (kids) => kids.filter((kid) => kid.importId === NO_IMPORT);
