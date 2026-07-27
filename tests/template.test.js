import { describe, it, expect } from 'vitest';
import {
  formatDateRo, fillLine, resolveTemplate, DEFAULT_TEMPLATES, DEFAULT_LINE_STYLES,
} from '../src/shared/template.js';
import { DIPLOMA_CSS } from '../src/shared/diplomaCss.js';

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

describe('DEFAULT_LINE_STYLES', () => {
  // The renderer only writes out what differs from these, so a value that
  // drifts from the stylesheet would silently restyle every old diploma.
  const SELECTOR = {
    title: '.diploma h1',
    award: '.diploma .award',
    name: '.diploma .name',
    part: '.diploma .part',
    dates: '.diploma .dates',
  };
  const ruleFor = (selector) => {
    const start = DIPLOMA_CSS.indexOf(selector + ' {');
    expect(start, `${selector} is missing from DIPLOMA_CSS`).toBeGreaterThan(-1);
    return DIPLOMA_CSS.slice(start, DIPLOMA_CSS.indexOf('}', start));
  };

  it('says what the stylesheet already prints, for every line', () => {
    for (const [slot, style] of Object.entries(DEFAULT_LINE_STYLES)) {
      const rule = ruleFor(SELECTOR[slot]);
      expect(rule, slot).toContain(`font-size: ${style.size}pt`);
      expect(rule.includes('font-weight: bold'), `${slot} bold`).toBe(style.bold);
      expect(rule.includes('font-style: italic'), `${slot} italic`).toBe(style.italic);
    }
  });

  it('gives both templates their own copy, so one is not restyled by the other', () => {
    expect(DEFAULT_TEMPLATES.kid.styles).toEqual(DEFAULT_LINE_STYLES);
    expect(DEFAULT_TEMPLATES.kid.styles).not.toBe(DEFAULT_TEMPLATES.teacher.styles);
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
    // How the lines are set is not gendered, and has to survive the split.
    expect(t.styles).toBe(DEFAULT_TEMPLATES.teacher.styles);
  });
});
