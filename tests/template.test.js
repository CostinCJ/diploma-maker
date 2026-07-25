import { describe, it, expect } from 'vitest';
import { formatDateRo, fillLine, DEFAULT_TEMPLATES } from '../src/shared/template.js';

describe('formatDateRo', () => {
  it('converts ISO to DD.MM.YYYY', () => {
    expect(formatDateRo('2026-07-07')).toBe('07.07.2026');
  });
  it('returns empty string for empty input', () => {
    expect(formatDateRo('')).toBe('');
  });
});

describe('fillLine', () => {
  it('substitutes {start} and {end}', () => {
    expect(fillLine('în perioada {start} - {end}', { start: '07.07.2026', end: '12.07.2026' }))
      .toBe('în perioada 07.07.2026 - 12.07.2026');
  });
  it('leaves lines without placeholders untouched', () => {
    expect(fillLine('Diplomă de participare', { start: 'x', end: 'y' }))
      .toBe('Diplomă de participare');
  });
});

describe('DEFAULT_TEMPLATES', () => {
  it('has kid and teacher templates with all four lines', () => {
    for (const key of ['kid', 'teacher']) {
      const t = DEFAULT_TEMPLATES[key];
      expect(t.title).toBeTruthy();
      expect(t.awardLine).toBeTruthy();
      expect(t.participationLine).toBeTruthy();
      expect(t.dateLine).toContain('{start}');
    }
    expect(DEFAULT_TEMPLATES.kid.awardLine).toBe('SE ACORDĂ ELEVULUI/ELEVEI');
    expect(DEFAULT_TEMPLATES.teacher.awardLine).toBe('SE ACORDĂ D-NEI ÎNSOȚITOARE');
  });
});
