// src/shared/validation.js

/** batch: 'kids' | 'teachers' | 'all'. Errors block generation; warnings need confirmation. */
export function validateForGeneration(session, batch) {
  const errors = [];
  const warnings = [];

  if (!session.startDate || !session.endDate) {
    errors.push('Setează datele sesiunii (început și sfârșit) în pasul 1.');
  }

  const clean = (list) => list.map((n) => n.trim()).filter(Boolean);
  const kids = clean(session.kids);
  const teachers = clean(session.teachers);
  const count = batch === 'kids' ? kids.length : batch === 'teachers' ? teachers.length : kids.length + teachers.length;
  if (count === 0) errors.push('Lista pentru acest lot este goală.');
  if ((batch === 'kids' && session.kids.some((n) => !n.trim()) && kids.length > 0)
    || (batch === 'teachers' && session.teachers.some((n) => !n.trim()) && teachers.length > 0)
    || (batch === 'all' && [...session.kids, ...session.teachers].some((n) => !n.trim()) && count > 0)) {
    errors.push('Există rânduri goale în listă — completează-le sau șterge-le.');
  }

  if (!session.background) warnings.push('Lipsește fotografia de fundal.');
  if (!session.logoLeft) warnings.push('Lipsește logo-ul din stânga.');
  if (!session.logoRight) warnings.push('Lipsește logo-ul din dreapta.');

  return { errors, warnings };
}
