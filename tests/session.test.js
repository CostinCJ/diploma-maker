// tests/session.test.js
import { describe, it, expect } from 'vitest';
import { defaultSession, mergeSession, kidNames, teacherNames } from '../src/shared/session.js';

describe('defaultSession', () => {
  it('has empty dates, assets, lists, and default templates', () => {
    const s = defaultSession();
    expect(s.startDate).toBe('');
    expect(s.endDate).toBe('');
    expect(s.background).toBe('');
    expect(s.logoLeft).toBe('');
    expect(s.logoRight).toBe('');
    expect(s.kids).toEqual([]);
    expect(s.teachers).toEqual([]);
    expect(s.templates.kid.awardLine).toBe('SE ACORDĂ ELEVULUI/ELEVEI');
  });
});

describe('mergeSession', () => {
  it('returns defaults for null input', () => {
    expect(mergeSession(null)).toEqual(defaultSession());
  });
  it('keeps loaded values and fills missing template lines from defaults', () => {
    const s = mergeSession({ startDate: '2026-07-07', kids: ['A B'], templates: { kid: { title: 'Custom' } } });
    expect(s.startDate).toBe('2026-07-07');
    expect(kidNames(s)).toEqual(['A B']);
    expect(s.templates.kid.title).toBe('Custom');
    expect(s.templates.kid.awardLine).toBe('SE ACORDĂ ELEVULUI/ELEVEI');
    expect(s.templates.teacher.awardLineF).toBe('SE ACORDĂ D-NEI ÎNSOȚITOARE');
  });

  // A corrupt session.json cannot be repaired from inside the app, so merging
  // must always produce a usable session rather than throwing later in the UI.
  it('falls back to defaults for a non-object session', () => {
    for (const bad of ['nope', 42, [], undefined]) {
      expect(mergeSession(bad)).toEqual(defaultSession());
    }
  });

  it('replaces wrongly-typed fields with defaults', () => {
    const s = mergeSession({ kids: 'A B', teachers: null, startDate: 20260707 });
    expect(s.kids).toEqual([]);
    expect(s.teachers).toEqual([]);
    expect(s.startDate).toBe('');
  });

  it('drops non-string list entries but keeps the real names', () => {
    expect(kidNames(mergeSession({ kids: ['A B', null, 7, 'C D'] }))).toEqual(['A B', 'C D']);
  });

  // Children used to be stored as plain names, before an import could be
  // removed on its own; those belong to no import and stay put.
  it('reads a kid list saved as plain names', () => {
    expect(mergeSession({ kids: ['A B'] }).kids).toEqual([{ name: 'A B', importId: '' }]);
  });

  it('keeps the import a name came from', () => {
    const s = mergeSession({
      kids: [{ name: 'A B', importId: 'i1' }, { name: 'C D' }],
      imports: [{ id: 'i1', label: 'lista.jpg', kind: 'photo' }],
    });
    expect(s.kids).toEqual([{ name: 'A B', importId: 'i1' }, { name: 'C D', importId: '' }]);
    expect(s.imports).toEqual([{ id: 'i1', label: 'lista.jpg', kind: 'photo', photo: '' }]);
  });

  it('keeps the stored photo of a photo import', () => {
    const s = mergeSession({ imports: [{ id: 'i1', label: 'lista.jpg', kind: 'photo', photo: 'C:/data/photos/i1.jpg' }] });
    expect(s.imports[0].photo).toBe('C:/data/photos/i1.jpg');
  });

  it('drops import records with no id and falls back for the rest', () => {
    const s = mergeSession({ imports: [{ label: 'x' }, 'nope', { id: 'i2', kind: 'weird' }] });
    expect(s.imports).toEqual([{ id: 'i2', label: 'i2', kind: 'file', photo: '' }]);
  });

  it('keeps a teacher name and the gender their diploma is worded for', () => {
    const s = mergeSession({ teachers: [{ name: 'C D', gender: 'm' }, { name: 'E F', gender: 'f' }] });
    expect(s.teachers).toEqual([{ name: 'C D', gender: 'm' }, { name: 'E F', gender: 'f' }]);
    expect(teacherNames(s)).toEqual(['C D', 'E F']);
  });

  // Sessions saved before the gendered wording existed hold plain strings.
  it('reads a teacher list saved as plain names, leaving the gender to be chosen', () => {
    expect(mergeSession({ teachers: ['C D'] }).teachers).toEqual([{ name: 'C D', gender: '' }]);
  });

  it('drops teacher entries that are not names and gender values it cannot use', () => {
    const s = mergeSession({ teachers: [{ name: 'C D', gender: 'x' }, { gender: 'm' }, null, 7] });
    expect(s.teachers).toEqual([{ name: 'C D', gender: '' }]);
  });

  it('keeps how strongly the group photo shows through', () => {
    expect(mergeSession({ backgroundOpacity: 0.15 }).backgroundOpacity).toBe(0.15);
  });

  it('clamps or ignores a strength it cannot use', () => {
    expect(mergeSession({ backgroundOpacity: 4 }).backgroundOpacity).toBe(1);
    expect(mergeSession({ backgroundOpacity: -2 }).backgroundOpacity).toBe(0);
    expect(mergeSession({ backgroundOpacity: '0.2' }).backgroundOpacity).toBe(0.5);
    expect(mergeSession({ backgroundOpacity: NaN }).backgroundOpacity).toBe(0.5);
  });

  it('ignores a non-object templates field instead of spreading it', () => {
    const s = mergeSession({ templates: 'broken' });
    expect(s.templates.kid.title).toBe(defaultSession().templates.kid.title);
    const s2 = mergeSession({ templates: { kid: 'broken' } });
    expect(s2.templates.kid.title).toBe(defaultSession().templates.kid.title);
  });

  it('ignores unknown keys from an older or hand-edited file', () => {
    expect(mergeSession({ leftovers: 'x' })).toEqual(defaultSession());
  });

  // mergeSession whitelists fields explicitly, so a field added to
  // defaultSession without being merged would silently reset on every load.
  it('covers every field of defaultSession', () => {
    expect(Object.keys(mergeSession({})).sort()).toEqual(Object.keys(defaultSession()).sort());
  });

  // The single accompanying-adult line (feminine only, then both genders at
  // once) is now one line per gender.
  it('replaces an old shipped award line with the two gendered defaults', () => {
    for (const old of ['SE ACORDĂ D-NEI ÎNSOȚITOARE', 'SE ACORDĂ D-LUI/D-NEI ÎNSOȚITOR/ÎNSOȚITOARE']) {
      const s = mergeSession({ templates: { teacher: { awardLine: old } } });
      expect(s.templates.teacher.awardLineM).toBe('SE ACORDĂ D-LUI ÎNSOȚITOR');
      expect(s.templates.teacher.awardLineF).toBe('SE ACORDĂ D-NEI ÎNSOȚITOARE');
      expect(s.templates.teacher.awardLine).toBeUndefined();
    }
  });

  it('carries wording the user actually edited into both gendered lines', () => {
    const s = mergeSession({ templates: { teacher: { awardLine: 'SE ACORDĂ DOAMNEI PROFESOARE' } } });
    expect(s.templates.teacher.awardLineM).toBe('SE ACORDĂ DOAMNEI PROFESOARE');
    expect(s.templates.teacher.awardLineF).toBe('SE ACORDĂ DOAMNEI PROFESOARE');
  });

  // How each line is set was added after the first camps; a session written
  // before it has to come back looking exactly as it was printed.
  it('gives a session without line styles the ones the stylesheet prints', () => {
    const s = mergeSession({ templates: { kid: { title: 'Custom' } } });
    expect(s.templates.kid.styles).toEqual(defaultSession().templates.kid.styles);
    expect(s.templates.kid.styles.title).toEqual({ size: 40, bold: true, italic: false });
  });

  it('keeps the sizes and the emphasis that were chosen', () => {
    const s = mergeSession({
      templates: { kid: { styles: { title: { size: 52, bold: false, italic: true } } } },
    });
    expect(s.templates.kid.styles.title).toEqual({ size: 52, bold: false, italic: true });
    expect(s.templates.kid.styles.dates).toEqual({ size: 14, bold: false, italic: false });
  });

  it('clamps, rounds or ignores a size it cannot use', () => {
    const size = (v) => mergeSession({ templates: { kid: { styles: { title: { size: v } } } } })
      .templates.kid.styles.title.size;
    expect(size(500)).toBe(80);
    expect(size(2)).toBe(8);
    expect(size(20.6)).toBe(21);
    expect(size('30')).toBe(40); // not a number: the default stands
    expect(size(NaN)).toBe(40);
  });

  it('ignores an emphasis flag that is not a boolean', () => {
    const s = mergeSession({ templates: { kid: { styles: { name: { bold: 'yes', italic: 1 } } } } });
    expect(s.templates.kid.styles.name).toEqual({ size: 26, bold: true, italic: false });
  });

  it('ignores a broken styles field instead of dropping the line', () => {
    for (const bad of ['x', 42, null, [{ size: 9 }]]) {
      const s = mergeSession({ templates: { kid: { styles: bad } } });
      expect(s.templates.kid.styles).toEqual(defaultSession().templates.kid.styles);
    }
  });

  it('prefers already-split lines over the old one', () => {
    const s = mergeSession({
      templates: {
        teacher: { awardLine: 'vechi', awardLineM: 'SE ACORDĂ DOMNULUI PROFESOR', awardLineF: 'SE ACORDĂ DOAMNEI PROFESOARE' },
      },
    });
    expect(s.templates.teacher.awardLineM).toBe('SE ACORDĂ DOMNULUI PROFESOR');
    expect(s.templates.teacher.awardLineF).toBe('SE ACORDĂ DOAMNEI PROFESOARE');
  });
});
