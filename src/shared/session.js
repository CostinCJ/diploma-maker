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
    ocrLayout: 'table', // 'table' = single-column participant list, 'auto' = free-form photo
    templates: structuredClone(DEFAULT_TEMPLATES),
  };
}

/** Merge a loaded (possibly partial/old) session over defaults. */
export function mergeSession(loaded) {
  const base = defaultSession();
  if (!loaded) return base;
  return {
    ...base,
    ...loaded,
    templates: {
      kid: { ...base.templates.kid, ...(loaded.templates?.kid ?? {}) },
      teacher: { ...base.templates.teacher, ...(loaded.templates?.teacher ?? {}) },
    },
  };
}
