// tests/session.test.js
import { describe, it, expect } from 'vitest';
import { defaultSession, mergeSession } from '../src/shared/session.js';

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
    expect(s.kids).toEqual(['A B']);
    expect(s.templates.kid.title).toBe('Custom');
    expect(s.templates.kid.awardLine).toBe('SE ACORDĂ ELEVULUI/ELEVEI');
    expect(s.templates.teacher.awardLine).toBe('SE ACORDĂ D-LUI/D-NEI ÎNSOȚITOR/ÎNSOȚITOARE');
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
    expect(mergeSession({ kids: ['A B', null, 7, 'C D'] }).kids).toEqual(['A B', 'C D']);
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

  it('upgrades wording that is still an old shipped default', () => {
    // The accompanying-adult line used to be feminine only.
    const s = mergeSession({ templates: { teacher: { awardLine: 'SE ACORDĂ D-NEI ÎNSOȚITOARE' } } });
    expect(s.templates.teacher.awardLine).toBe('SE ACORDĂ D-LUI/D-NEI ÎNSOȚITOR/ÎNSOȚITOARE');
  });

  it('never overwrites wording the user actually edited', () => {
    const s = mergeSession({ templates: { teacher: { awardLine: 'SE ACORDĂ DOAMNEI PROFESOARE' } } });
    expect(s.templates.teacher.awardLine).toBe('SE ACORDĂ DOAMNEI PROFESOARE');
  });
});
