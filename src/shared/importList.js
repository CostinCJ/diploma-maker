// src/shared/importList.js
// Shared parsing for every typed source of names: pasted text, .txt/.csv files,
// Word tables, Excel sheets. Unlike OCR output (see nameParsing.js) these
// sources are trustworthy — nothing is discarded as "noise". Only structure is
// removed (row numbers, header rows, columns that hold something other than a
// name), so a name written in mixed case arrives exactly as it was written.

const LOOKALIKE = { Ş: 'Ș', ş: 'ș', Ţ: 'Ț', ţ: 'ț' };

/** Collapse whitespace and fold the cedilla lookalikes Word and Excel emit
 *  (Ş/Ţ) onto the Romanian comma-below letters (Ș/Ț). Without this the same
 *  child imported from two different files reads as two different people. */
export function normalizeName(raw) {
  return String(raw ?? '')
    .replace(/[ŞşŢţ]/g, (c) => LOOKALIKE[c])
    // A name never contains a comma, so one that survived here is a separator
    // that was quoted away: "Popescu, Ion" is one child, printed without it.
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Comparison key for "is this the same name?" — used both when importing and
 *  when validating a session, so the two always agree on what a duplicate is. */
export const nameKey = (name) => normalizeName(name).toLocaleUpperCase('ro-RO');

// Words that only ever appear in a list's header, never in a child's name.
const HEADER_WORD = /^(nr|crt|no|nume|numele|prenume|prenumele|si|și|al|ale|a|de|la|elev|elevi|elevul|elevilor|copil|copii|copilul|copiilor|participant|participanti|participanți|participante|tabel|tabelul|lista|listă|grup|grupa|grupul|clasa|scoala|școala|varsta|vârsta|observatii|observații)$/i;

// A column header that names the column we want.
const NAME_HEADER = /nume|prenume|elev|copil|participant/i;

const letterCount = (s) => (s.match(/\p{L}/gu) || []).length;

function isHeaderRow(cells) {
  const words = cells.join(' ').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every((w) => HEADER_WORD.test(w));
}

/** Split one line into cells on tab / semicolon / pipe / comma, honouring the
 *  double quotes Excel writes around a cell that itself contains a separator. */
export function splitCells(line) {
  const cells = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (ch === '\t' || ch === ';' || ch === '|' || ch === ',')) {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/** Which columns hold names. With a header row the header decides; without one,
 *  a column qualifies by being mostly filled with letters and no digits — which
 *  drops the row-number column and an age or group column, and keeps a list
 *  split into separate "Nume" and "Prenume" columns. */
function nameColumns(dataRows, headerRow, width) {
  if (headerRow) {
    const byHeader = [];
    for (let col = 0; col < width; col++) {
      if (NAME_HEADER.test(headerRow[col] ?? '')) byHeader.push(col);
    }
    if (byHeader.length) return byHeader;
  }
  const keep = [];
  for (let col = 0; col < width; col++) {
    const values = dataRows.map((cells) => cells[col] ?? '');
    const filled = values.filter(Boolean);
    if (!filled.length || filled.length < values.length * 0.5) continue;
    const nameish = filled.filter((v) => letterCount(v) >= 2 && !/\d/.test(v));
    if (nameish.length >= filled.length * 0.7) keep.push(col);
  }
  return keep;
}

/** Rows of cells (from a paste, a CSV, a Word table or an Excel sheet) → names. */
export function parseTableRows(rows) {
  const cleaned = rows.map((cells) => cells.map(normalizeName));
  for (const cells of cleaned) {
    // A row number written into the same cell as the name: "1. POPESCU ION".
    if (cells.length) cells[0] = cells[0].replace(/^\d{1,3}\s*[.)\]:-]?\s*/, '');
  }
  const body = cleaned.filter((cells) => cells.some(Boolean));
  if (!body.length) return [];

  const width = Math.max(...body.map((cells) => cells.length));
  const headerRow = isHeaderRow(body[0]) ? body[0] : null;
  const dataRows = headerRow ? body.slice(1) : body;
  const columns = nameColumns(dataRows, headerRow, width);
  // Every column looked unusable (a single-column list of one-word names, say):
  // keep everything rather than return nothing.
  const keep = columns.length ? columns : [...Array(width).keys()];

  return dataRows
    .map((cells) => normalizeName(keep.map((col) => cells[col] ?? '').filter(Boolean).join(' ')))
    .filter((name) => letterCount(name) >= 2 && !isHeaderRow([name]));
}

/** Free text (a paste, a .txt or .csv file) → names. */
export function parseTextList(text) {
  return parseTableRows(String(text ?? '').split(/\r?\n/).map(splitCells));
}

/** Tag each incoming name against the list it is about to join, so the import
 *  preview can show what is new and leave duplicates unticked.
 *  status: 'new' | 'existing' (already in the list) | 'repeat' (twice in this batch). */
export function planImport(existing, incoming) {
  const known = new Set(existing.map(nameKey).filter(Boolean));
  const batch = new Set();
  return incoming.map((name) => {
    const key = nameKey(name);
    const status = known.has(key) ? 'existing' : batch.has(key) ? 'repeat' : 'new';
    batch.add(key);
    return { name, status };
  });
}
