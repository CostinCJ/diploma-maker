/** '2026-07-07' → '07.07.2026' */
export function formatDateRo(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

/** Replace {start}/{end} placeholders in a template line. */
export function fillLine(line, ctx) {
  return line.replaceAll('{start}', ctx.start ?? '').replaceAll('{end}', ctx.end ?? '');
}

/** The five lines a diploma prints, top to bottom, and how each is set unless
 *  the guide says otherwise. These values are the ones DIPLOMA_CSS already
 *  carries (tests/template.test.js holds the two together): a line left alone
 *  is rendered by the stylesheet, exactly as every diploma was before the size
 *  and the emphasis could be chosen. */
export const DEFAULT_LINE_STYLES = {
  title: { size: 40, bold: true, italic: false },
  award: { size: 16, bold: false, italic: false },
  name: { size: 26, bold: true, italic: false },
  part: { size: 16, bold: false, italic: true },
  dates: { size: 14, bold: false, italic: false },
};

/** Sizes outside this range either vanish or run off the sheet. */
export const MIN_LINE_SIZE = 8;
export const MAX_LINE_SIZE = 80;

export const defaultLineStyles = () => structuredClone(DEFAULT_LINE_STYLES);

export const DEFAULT_TEMPLATES = {
  kid: {
    title: 'Diplomă de participare',
    awardLine: 'SE ACORDĂ ELEVULUI/ELEVEI',
    participationLine: 'pentru participarea la TABERE APUSENI',
    dateLine: 'în perioada {start} - {end}',
    styles: defaultLineStyles(),
  },
  // Accompanying adults are named one by one, so their diploma names one
  // gender instead of printing both forms separated by a slash. Everything
  // except the award line is shared between the two.
  teacher: {
    title: 'Diplomă de participare',
    awardLineM: 'SE ACORDĂ D-LUI ÎNSOȚITOR',
    awardLineF: 'SE ACORDĂ D-NEI ÎNSOȚITOARE',
    participationLine: 'pentru participarea la TABERE APUSENI',
    dateLine: 'în perioada {start} - {end}',
    styles: defaultLineStyles(),
  },
};

/** The template to render for one entry. A teacher's gender picks the award
 *  line here, so everything downstream sees an ordinary single-line template. */
export function resolveTemplate(templates, { tpl, gender }) {
  if (tpl !== 'teacher') return templates[tpl];
  const { awardLineM, awardLineF, ...rest } = templates.teacher;
  return { ...rest, awardLine: gender === 'm' ? awardLineM : awardLineF };
}
