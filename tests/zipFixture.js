// tests/zipFixture.js
// Minimal ZIP writer, so the .docx / .xlsx tests build their own fixtures
// instead of committing binary files nobody can review in a diff.
import { deflateRawSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => (~[...buf].reduce((c, b) => crcTable[(c ^ b) & 0xff] ^ (c >>> 8), ~0)) >>> 0;

/** files: { 'word/document.xml': '<xml…>' }. Entries alternate between stored
 *  and deflated so both paths of the reader are exercised. */
export function buildZip(files) {
  const entries = [];
  const parts = [];
  let offset = 0;

  Object.entries(files).forEach(([name, content], i) => {
    const raw = Buffer.from(content, 'utf8');
    const deflate = i % 2 === 1;
    const data = deflate ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(deflate ? 8 : 0, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    entries.push(Buffer.concat([central, nameBuf]));

    offset += local.length + nameBuf.length + data.length;
  });

  const directory = Buffer.concat(entries);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  const zip = Buffer.concat([...parts, directory, eocd]);
  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
}

/** A .docx whose document.xml is built from paragraphs (strings) and tables
 *  (arrays of rows of cells). */
export function buildDocx(blocks) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const paragraph = (text) => `<w:p><w:r><w:t>${esc(text)}</w:t></w:r></w:p>`;
  const body = blocks.map((block) => (Array.isArray(block)
    ? `<w:tbl>${block.map((row) => `<w:tr>${row.map((cell) => `<w:tc>${paragraph(cell)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`
    : paragraph(block))).join('');
  return buildZip({
    '[Content_Types].xml': '<Types/>',
    'word/document.xml': `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`,
  });
}

/** An .xlsx with one sheet, all cells written as shared strings (what Excel
 *  itself does for text) except numbers, which are written inline. */
export function buildXlsx(rows) {
  const strings = [];
  const indexOf = (value) => {
    const at = strings.indexOf(value);
    return at === -1 ? strings.push(value) - 1 : at;
  };
  const sheetRows = rows.map((cells, r) => {
    const xml = cells.map((value, c) => {
      const ref = String.fromCharCode(65 + c) + (r + 1);
      if (value === '') return '';
      return /^\d+$/.test(value)
        ? `<c r="${ref}"><v>${value}</v></c>`
        : `<c r="${ref}" t="s"><v>${indexOf(value)}</v></c>`;
    }).join('');
    return `<row r="${r + 1}">${xml}</row>`;
  }).join('');
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return buildZip({
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
    'xl/sharedStrings.xml': `<?xml version="1.0"?><sst>${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`,
  });
}
