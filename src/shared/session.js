// src/shared/session.js
import { DEFAULT_TEMPLATES } from './template.js';

export function defaultSession() {
  return {
    startDate: '',
    endDate: '',
    background: '',
    logoLeft: '',
    logoRight: '',
    kids: [],
    teachers: [],
    templates: structuredClone(DEFAULT_TEMPLATES),
  };
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const asText = (v, fallback) => (typeof v === 'string' ? v : fallback);
/** Non-string entries were never names (hand-edited or half-written file) — drop them. */
const asNameList = (v) => (Array.isArray(v) ? v.filter((n) => typeof n === 'string') : []);

/** Wording that shipped as a default in an earlier version. A session still
 *  carrying one of these verbatim was never edited by the user, so it is safe
 *  to move it to the current default — otherwise an existing session would keep
 *  the outdated line forever. Anything the user actually typed is left alone. */
const SUPERSEDED_LINES = {
  // Feminine-only; accompanying adults can be men too.
  awardLine: ['SE ACORDĂ D-NEI ÎNSOȚITOARE'],
};

function mergeTemplate(base, loaded) {
  if (!isObject(loaded)) return base;
  const out = { ...base };
  for (const key of Object.keys(base)) {
    const value = asText(loaded[key], base[key]);
    out[key] = SUPERSEDED_LINES[key]?.includes(value) ? base[key] : value;
  }
  return out;
}

/** Merge a loaded (possibly partial, old, or corrupt) session over defaults.
 *  Every field is type-checked on the way in: a malformed session.json must not
 *  be able to crash the UI at startup, because the user has no way to repair it
 *  from inside the app. */
export function mergeSession(loaded) {
  const base = defaultSession();
  if (!isObject(loaded)) return base;
  const templates = isObject(loaded.templates) ? loaded.templates : {};
  return {
    startDate: asText(loaded.startDate, base.startDate),
    endDate: asText(loaded.endDate, base.endDate),
    background: asText(loaded.background, base.background),
    logoLeft: asText(loaded.logoLeft, base.logoLeft),
    logoRight: asText(loaded.logoRight, base.logoRight),
    kids: asNameList(loaded.kids),
    teachers: asNameList(loaded.teachers),
    templates: {
      kid: mergeTemplate(base.templates.kid, templates.kid),
      teacher: mergeTemplate(base.templates.teacher, templates.teacher),
    },
  };
}
