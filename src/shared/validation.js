// src/shared/validation.js
import { nameKey } from './importList.js';
import { kidNames, teacherNames } from './session.js';

const nonEmpty = (list) => list.map((n) => n.trim()).filter(Boolean);

/** Names that appear more than once, in first-seen spelling. Re-importing the
 *  same photo is easy to do by accident and silently doubles the whole list.
 *  Sameness is decided by the same key the import preview uses, so a name it
 *  called a duplicate is never reported as unique here (or the other way). */
function duplicateNames(names) {
  const seen = new Map();
  const dupes = [];
  for (const name of names) {
    const key = nameKey(name);
    if (!seen.has(key)) seen.set(key, name);
    else if (!dupes.includes(seen.get(key))) dupes.push(seen.get(key));
  }
  return dupes;
}

/** batch: 'kids' | 'teachers' | 'all'. Errors block generation; warnings need confirmation. */
export function validateForGeneration(session, batch) {
  const errors = [];
  const warnings = [];

  if (!session.startDate || !session.endDate) {
    errors.push('Setează datele sesiunii (început și sfârșit) în pasul 1.');
  } else if (session.endDate < session.startDate) {
    // Both are ISO 'YYYY-MM-DD', so a string comparison is a date comparison.
    errors.push('Data de sfârșit este înaintea datei de început.');
  }

  const rows = batch === 'kids' ? kidNames(session)
    : batch === 'teachers' ? teacherNames(session)
      : [...kidNames(session), ...teacherNames(session)];
  const names = nonEmpty(rows);

  // Each accompanying adult's diploma is worded for one gender, so an
  // unanswered choice would print the wrong word. Blocking is on purpose:
  // there is no defensible guess, and the list is a handful of names.
  if (batch !== 'kids') {
    const unset = session.teachers.filter((t) => t.name.trim() && !t.gender).map((t) => t.name);
    if (unset.length) {
      errors.push(`Alege forma (însoțitor / însoțitoare) pentru: ${unset.join(', ')}.`);
    }
  }
  if (names.length === 0) {
    errors.push('Lista pentru acest lot este goală.');
  } else if (rows.some((n) => !n.trim())) {
    errors.push('Există rânduri goale în listă — completează-le sau șterge-le.');
  }

  const dupes = duplicateNames(names);
  if (dupes.length) {
    const shown = dupes.slice(0, 5).join(', ') + (dupes.length > 5 ? ` și încă ${dupes.length - 5}` : '');
    warnings.push(`Nume care apar de mai multe ori: ${shown}.`);
  }

  if (!session.background) warnings.push('Lipsește fotografia de fundal.');
  if (!session.logoLeft) warnings.push('Lipsește logo-ul din stânga.');
  if (!session.logoRight) warnings.push('Lipsește logo-ul din dreapta.');

  return { errors, warnings };
}
