// src/shared/importFile.js
// One entry point for every list file a guide might drop on the app.

import { parseTableRows, parseTextList } from './importList.js';
import { docxRows, xlsxRows, isZip, isLegacyOffice } from './officeDocs.js';

/** Text files still arrive in the local Windows encoding surprisingly often
 *  (Excel's plain "CSV" export), where the Romanian diacritics are not valid
 *  UTF-8 — decoding those strictly and falling back keeps the names readable. */
export function decodeText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

const extensionOf = (fileName) => (/\.([a-z0-9]+)$/i.exec(fileName)?.[1] ?? '').toLowerCase();

export const SUPPORTED_EXTENSIONS = ['docx', 'xlsx', 'csv', 'txt'];

/** File bytes → names, chosen by extension and checked against the file's own
 *  magic bytes so a mislabelled file fails with an explanation instead of
 *  producing nonsense. */
export async function namesFromFile(fileName, arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const ext = extensionOf(fileName);

  if (isLegacyOffice(bytes)) {
    throw new Error(`${fileName}: formatul vechi Word/Excel (.doc, .xls) nu poate fi citit. `
      + 'Deschide fișierul în Word sau Excel și salvează-l ca .docx / .xlsx.');
  }

  if (ext === 'docx' || ext === 'xlsx') {
    if (!isZip(bytes)) throw new Error(`${fileName}: fișierul pare deteriorat sau nu este un fișier ${ext}.`);
    return parseTableRows(ext === 'docx' ? await docxRows(arrayBuffer) : await xlsxRows(arrayBuffer));
  }

  if (ext === 'csv' || ext === 'txt' || ext === '') return parseTextList(decodeText(bytes));

  throw new Error(`${fileName}: tip de fișier neacceptat. Acceptate: `
    + SUPPORTED_EXTENSIONS.map((e) => '.' + e).join(', ') + '.');
}
