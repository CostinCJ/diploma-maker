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
  // Accompanying adults are named one by one, so their diploma names one
  // gender instead of printing both forms separated by a slash. Everything
  // except the award line is shared between the two.
  teacher: {
    title: 'Diplomă de participare',
    awardLineM: 'SE ACORDĂ D-LUI ÎNSOȚITOR',
    awardLineF: 'SE ACORDĂ D-NEI ÎNSOȚITOARE',
    participationLine: 'pentru participarea la TABERE APUSENI',
    dateLine: 'în perioada {start} - {end}',
  },
};

/** The template to render for one entry. A teacher's gender picks the award
 *  line here, so everything downstream sees an ordinary single-line template. */
export function resolveTemplate(templates, { tpl, gender }) {
  if (tpl !== 'teacher') return templates[tpl];
  const { awardLineM, awardLineF, ...rest } = templates.teacher;
  return { ...rest, awardLine: gender === 'm' ? awardLineM : awardLineF };
}
