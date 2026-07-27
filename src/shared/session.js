// src/shared/session.js
import { DEFAULT_TEMPLATES } from './template.js';

export function defaultSession() {
  return {
    name: '', // what this shift is called in the session picker
    startDate: '',
    endDate: '',
    background: '',
    backgroundOpacity: 0.5, // how strongly the group photo shows through
    logoLeft: '',
    logoRight: '',
    kids: [],
    teachers: [],
    imports: [],
    templates: structuredClone(DEFAULT_TEMPLATES),
  };
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const asText = (v, fallback) => (typeof v === 'string' ? v : fallback);
const asFraction = (v, fallback) => (typeof v === 'number' && Number.isFinite(v)
  ? Math.min(1, Math.max(0, v))
  : fallback);

const IMPORT_KINDS = ['photo', 'file', 'paste'];

/** Every child's name remembers the import it arrived in (empty when typed by
 *  hand), so that import can be removed later on its own. Sessions written
 *  before that existed hold plain strings, which become typed-in names. */
const asKidList = (v) => (Array.isArray(v) ? v : [])
  .map((k) => {
    if (typeof k === 'string') return { name: k, importId: '' };
    if (!isObject(k) || typeof k.name !== 'string') return null;
    return { name: k.name, importId: asText(k.importId, '') };
  })
  .filter(Boolean);

const asImportList = (v) => (Array.isArray(v) ? v : [])
  .filter((i) => isObject(i) && typeof i.id === 'string' && i.id)
  .map((i) => ({
    id: i.id,
    label: asText(i.label, i.id),
    kind: IMPORT_KINDS.includes(i.kind) ? i.kind : 'file',
    photo: asText(i.photo, ''), // absolute path in the app data directory
  }));

/** Names only, for the checks and lists that do not care where they came from. */
export const kidNames = (session) => session.kids.map((k) => k.name);

/** Teachers carry the gender their diploma is worded for. Sessions written
 *  before that existed hold plain strings, which become ungendered entries —
 *  the gender is then asked for once, before printing. */
const asTeacherList = (v) => (Array.isArray(v) ? v : [])
  .map((t) => {
    if (typeof t === 'string') return { name: t, gender: '' };
    if (!isObject(t) || typeof t.name !== 'string') return null;
    return { name: t.name, gender: t.gender === 'm' || t.gender === 'f' ? t.gender : '' };
  })
  .filter(Boolean);

/** Names only, for the checks and lists that do not care about gender. */
export const teacherNames = (session) => session.teachers.map((t) => t.name);

/** Wording that shipped as a default of the single teacher award line, before
 *  it was split into one line per gender. A session still carrying one of these
 *  verbatim was never edited by the user, so it is dropped for the current
 *  defaults; a line the user actually wrote is kept for both genders, for them
 *  to split by hand — it is the only place their wording still exists. */
const SUPERSEDED_TEACHER_AWARD_LINES = [
  'SE ACORDĂ D-NEI ÎNSOȚITOARE',                  // feminine only
  'SE ACORDĂ D-LUI/D-NEI ÎNSOȚITOR/ÎNSOȚITOARE',  // both genders on one diploma
];

function migrateTeacherTemplate(loaded) {
  if (!isObject(loaded)) return loaded;
  const old = asText(loaded.awardLine, '');
  if (!old || SUPERSEDED_TEACHER_AWARD_LINES.includes(old)) return loaded;
  return { awardLineM: old, awardLineF: old, ...loaded };
}

function mergeTemplate(base, loaded) {
  if (!isObject(loaded)) return base;
  const out = { ...base };
  for (const key of Object.keys(base)) out[key] = asText(loaded[key], base[key]);
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
    name: asText(loaded.name, base.name),
    startDate: asText(loaded.startDate, base.startDate),
    endDate: asText(loaded.endDate, base.endDate),
    background: asText(loaded.background, base.background),
    backgroundOpacity: asFraction(loaded.backgroundOpacity, base.backgroundOpacity),
    logoLeft: asText(loaded.logoLeft, base.logoLeft),
    logoRight: asText(loaded.logoRight, base.logoRight),
    kids: asKidList(loaded.kids),
    teachers: asTeacherList(loaded.teachers),
    imports: asImportList(loaded.imports),
    templates: {
      kid: mergeTemplate(base.templates.kid, templates.kid),
      teacher: mergeTemplate(base.templates.teacher, migrateTeacherTemplate(templates.teacher)),
    },
  };
}
