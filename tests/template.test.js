import { describe, it, expect } from 'vitest';
import { formatDateRo, fillLine, resolveTemplate, DEFAULT_TEMPLATES } from '../src/shared/template.js';

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
      expect(t.participationLine).toBeTruthy();
      expect(t.dateLine).toContain('{start}');
    }
    expect(DEFAULT_TEMPLATES.kid.awardLine).toBe('SE ACORDĂ ELEVULUI/ELEVEI');
    expect(DEFAULT_TEMPLATES.teacher.awardLineM).toBe('SE ACORDĂ D-LUI ÎNSOȚITOR');
    expect(DEFAULT_TEMPLATES.teacher.awardLineF).toBe('SE ACORDĂ D-NEI ÎNSOȚITOARE');
  });

  it('names one gender per teacher award line', () => {
    expect(DEFAULT_TEMPLATES.teacher.awardLineM).not.toContain('/');
    expect(DEFAULT_TEMPLATES.teacher.awardLineF).not.toContain('/');
  });
});

describe('resolveTemplate', () => {
  it('gives a kid the kid template unchanged', () => {
    expect(resolveTemplate(DEFAULT_TEMPLATES, { tpl: 'kid' })).toEqual(DEFAULT_TEMPLATES.kid);
  });

  it('picks the award line of the chosen gender', () => {
    expect(resolveTemplate(DEFAULT_TEMPLATES, { tpl: 'teacher', gender: 'm' }).awardLine)
      .toBe('SE ACORDĂ D-LUI ÎNSOȚITOR');
    expect(resolveTemplate(DEFAULT_TEMPLATES, { tpl: 'teacher', gender: 'f' }).awardLine)
      .toBe('SE ACORDĂ D-NEI ÎNSOȚITOARE');
  });

  it('leaves no gendered lines behind for the renderer to print', () => {
    const t = resolveTemplate(DEFAULT_TEMPLATES, { tpl: 'teacher', gender: 'f' });
    expect(t.awardLineM).toBeUndefined();
    expect(t.awardLineF).toBeUndefined();
    expect(t.participationLine).toBe(DEFAULT_TEMPLATES.teacher.participationLine);
  });
});
