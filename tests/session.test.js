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
    expect(s.ocrLayout).toBe('table');
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
    expect(s.templates.teacher.awardLine).toBe('SE ACORDĂ D-NEI ÎNSOȚITOARE');
  });
});
