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

export const DEFAULT_TEMPLATES = {
  kid: {
    title: 'Diplomă de participare',
    awardLine: 'SE ACORDĂ ELEVULUI/ELEVEI',
    participationLine: 'pentru participarea la TABERE APUSENI',
    dateLine: 'în perioada {start} - {end}',
  },
  teacher: {
    title: 'Diplomă de participare',
    awardLine: 'SE ACORDĂ D-NEI ÎNSOȚITOARE',
    participationLine: 'pentru participarea la TABERE APUSENI',
    dateLine: 'în perioada {start} - {end}',
  },
};
