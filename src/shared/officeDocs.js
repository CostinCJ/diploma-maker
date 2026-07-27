// src/shared/officeDocs.js
// Readers for the two office formats camp lists actually arrive in. Both .docx
// and .xlsx are ZIP archives of XML, so the archive is unpacked with the
// platform's own DecompressionStream and the XML is scanned with regexes: no
// library, nothing to download, nothing that could reach the network. Only the
// text is extracted — formatting, images and metadata are ignored.

const ZIP = [0x50, 0x4b, 0x03, 0x04];  // "PK\x03\x04"
const OLE = [0xd0, 0xcf, 0x11, 0xe0];  // legacy Office (.doc, .xls)

const startsWith = (bytes, sig) => sig.every((b, i) => bytes[i] === b);

export const isZip = (bytes) => startsWith(bytes, ZIP);
export const isLegacyOffice = (bytes) => startsWith(bytes, OLE);

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** ZIP archive → Map of entry name to bytes. Reads the central directory (the
 *  only place sizes are guaranteed to be filled in) and supports the two
 *  compression methods office files use: stored and deflate. Zip64 is not
 *  handled — a list of names is never anywhere near 4 GB. */
export async function unzip(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o) => view.getUint16(o, true);
  const u32 = (o) => view.getUint32(o, true);

  // End of central directory: a 22-byte record that may be followed by a comment.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 0xffff; i--) {
    if (u32(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Fișierul nu este o arhivă validă.');

  const files = new Map();
  const decoder = new TextDecoder();
  let p = u32(eocd + 16);
  for (let i = u16(eocd + 10); i > 0; i--) {
    if (p + 46 > bytes.length || u32(p) !== 0x02014b50) break;
    const method = u16(p + 10);
    const compressedSize = u32(p + 20);
    const nameLen = u16(p + 28);
    const extraLen = u16(p + 30);
    const commentLen = u16(p + 32);
    const localOffset = u32(p + 42);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    // The local header repeats the name and may carry a different extra field,
    // so the data offset has to be computed from the local header, not this one.
    const start = localOffset + 30 + u16(localOffset + 26) + u16(localOffset + 28);
    const raw = bytes.subarray(start, start + compressedSize);
    files.set(name, method === 0 ? raw : await inflateRaw(raw));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const ENTITY = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeXml(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] !== '#') return ENTITY[code.toLowerCase()] ?? match;
    const hex = code[1] === 'x' || code[1] === 'X';
    return String.fromCodePoint(parseInt(hex ? code.slice(2) : code.slice(1), hex ? 16 : 10));
  });
}

const textOf = (chunk, tag) => [...chunk.matchAll(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'g'))]
  .map(([, inner]) => decodeXml(inner))
  .join('');

/** Text of one Word paragraph or table cell. Tabs and manual line breaks live
 *  outside the text runs, so they are turned into runs of their own first. */
const runsText = (chunk) => textOf(
  chunk
    .replace(/<w:tab\b[^>]*>/g, '<w:t>\t</w:t>')
    .replace(/<w:br\b[^>]*>/g, '<w:t>\n</w:t>'),
  'w:t',
);

/** word/document.xml → rows of cells. A table row is one row; a plain
 *  paragraph is one row too, split on tabs so a tabbed "1<tab>NAME" layout
 *  reads like a table. */
export function docxRowsFromXml(xml) {
  const rows = [];
  // A <w:tr> starts before any <w:p> it contains, so the leftmost-match rule
  // consumes whole table rows and never re-reads their paragraphs.
  const blocks = /<w:tr\b[\s\S]*?<\/w:tr>|<w:p\b(?:[^>]*\/>|[^>]*>[\s\S]*?<\/w:p>)/g;
  for (const [chunk] of xml.matchAll(blocks)) {
    if (chunk.startsWith('<w:tr')) {
      rows.push([...chunk.matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)]
        .map(([cell]) => runsText(cell).replace(/[\t\n]+/g, ' ')));
    } else {
      for (const line of runsText(chunk).split('\n')) rows.push(line.split('\t'));
    }
  }
  return rows;
}

/** xl/sharedStrings.xml → the string table an .xlsx cell refers to by index. */
export function sharedStringsFromXml(xml) {
  return [...xml.matchAll(/<(?:\w+:)?si(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?si>/g)]
    .map(([, si]) => textOf(si, 't'));
}

const columnIndex = (ref) => [...ref].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;

/** One xl/worksheets/sheetN.xml → rows of cells. Cell references are honoured
 *  so that a skipped (empty) cell keeps the later columns in place. */
export function xlsxRowsFromXml(xml, sharedStrings = []) {
  const rows = [];
  const rowRe = /<(?:\w+:)?row\b[^>]*(?:\/>|>[\s\S]*?<\/(?:\w+:)?row>)/g;
  const cellRe = /<(?:\w+:)?c\b([^>]*)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
  for (const [rowChunk] of xml.matchAll(rowRe)) {
    const cells = [];
    for (const [, attrs = '', body = ''] of rowChunk.matchAll(cellRe)) {
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const at = ref ? columnIndex(ref) : cells.length;
      let text = '';
      if (type === 's') text = sharedStrings[Number(textOf(body, 'v'))] ?? '';
      else if (type === 'inlineStr') text = textOf(body, 't');
      else text = textOf(body, 'v');
      while (cells.length < at) cells.push('');
      cells[at] = text;
    }
    rows.push(cells);
  }
  return rows;
}

/** .docx bytes → rows of cells. */
export async function docxRows(arrayBuffer) {
  const files = await unzip(arrayBuffer);
  const document = files.get('word/document.xml');
  if (!document) throw new Error('Documentul Word nu conține text (word/document.xml lipsește).');
  return docxRowsFromXml(new TextDecoder().decode(document));
}

/** .xlsx bytes → rows of cells, from the first worksheet. */
export async function xlsxRows(arrayBuffer) {
  const files = await unzip(arrayBuffer);
  const decoder = new TextDecoder();
  const shared = files.has('xl/sharedStrings.xml')
    ? sharedStringsFromXml(decoder.decode(files.get('xl/sharedStrings.xml')))
    : [];
  const [sheet] = [...files.keys()].filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort();
  if (!sheet) throw new Error('Fișierul Excel nu conține nicio foaie de calcul.');
  return xlsxRowsFromXml(decoder.decode(files.get(sheet)), shared);
}
