// src/shared/nameParsing.js
// Matched after punctuation has been stripped, so 'NR.' arrives here as 'NR'.
const HEADER_RE = /TABEL|PARTICIPAN|NUMELE|PRENUMELE|ELEVILOR|^NR$/i;
const UPPER_RE = /[A-ZĂÂÎȘȚŞŢ]/;
const countUpper = (s) => (s.match(/[A-ZĂÂÎȘȚŞŢ]/g) || []).length;

/** OCR text of a participant list → array of clean names, one per row.
 *  Names in these lists are uppercase, so tokens without an uppercase letter
 *  and trailing one-letter tokens are treated as OCR noise. Rows that keep
 *  too little uppercase text are dropped entirely. */
export function parseNamesFromOcrText(text) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const cleaned = line
        .replace(/^[\s|,._]*\d{1,3}\s*[.,]?\s*/, '')          // leading row number + punctuation
        .replace(/[^A-Za-zĂÂÎȘȚăâîșțŞŢşţ\s-]/g, ' ')          // OCR junk symbols → space
        .replace(/\s+/g, ' ')
        .trim();
      const tokens = cleaned.split(' ').filter((t) => UPPER_RE.test(t));
      while (tokens.length > 1 && tokens[tokens.length - 1].length === 1) tokens.pop();
      return tokens.join(' ');
    })
    .filter((s) => s.length >= 3)
    .filter((s) => !HEADER_RE.test(s))
    .filter((s) => {
      const words = s.split(' ');
      const uppers = countUpper(s);
      return (words.length >= 2 && uppers >= 4) || (words.length === 1 && uppers >= 5);
    });
}
