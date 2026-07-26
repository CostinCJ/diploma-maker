import { describe, it, expect } from 'vitest';
import { validateForGeneration } from '../src/shared/validation.js';
import { defaultSession } from '../src/shared/session.js';

function readySession() {
  return {
    ...defaultSession(),
    startDate: '2026-07-07', endDate: '2026-07-12',
    background: 'C:/x/bg.jpg', logoLeft: 'C:/x/l.png', logoRight: 'C:/x/r.png',
    kids: ['A B'], teachers: ['C D'],
  };
}

describe('validateForGeneration', () => {
  it('passes a complete session', () => {
    expect(validateForGeneration(readySession(), 'all')).toEqual({ errors: [], warnings: [] });
  });

  it('errors on missing dates', () => {
    const s = { ...readySession(), startDate: '' };
    expect(validateForGeneration(s, 'all').errors.length).toBeGreaterThan(0);
  });

  it('errors on an empty batch', () => {
    const s = { ...readySession(), kids: [] };
    expect(validateForGeneration(s, 'kids').errors.length).toBeGreaterThan(0);
    expect(validateForGeneration(s, 'teachers').errors).toEqual([]);
  });

  it('errors on blank-only names', () => {
    const s = { ...readySession(), kids: ['  '] };
    expect(validateForGeneration(s, 'kids').errors.length).toBeGreaterThan(0);
  });

  it('errors on blank rows mixed with real names', () => {
    const s = { ...readySession(), kids: ['A B', '  ', 'C D'] };
    const r = validateForGeneration(s, 'kids');
    expect(r.errors.some((e) => e.includes('rânduri goale'))).toBe(true);
  });

  it('warns (not errors) on missing images so the user can proceed intentionally', () => {
    const s = { ...readySession(), background: '', logoLeft: '' };
    const r = validateForGeneration(s, 'all');
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBe(2);
  });

  it('errors when the end date is before the start date', () => {
    const s = { ...readySession(), startDate: '2026-07-12', endDate: '2026-07-07' };
    expect(validateForGeneration(s, 'all').errors.some((e) => e.includes('sfârșit'))).toBe(true);
  });

  it('accepts a single-day session', () => {
    const s = { ...readySession(), startDate: '2026-07-07', endDate: '2026-07-07' };
    expect(validateForGeneration(s, 'all').errors).toEqual([]);
  });

  it('warns about duplicate names, ignoring case and extra spaces', () => {
    const s = { ...readySession(), kids: ['POPESCU ANA', 'popescu   ana', 'IONESCU DAN'] };
    const r = validateForGeneration(s, 'kids');
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('POPESCU ANA'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('IONESCU DAN'))).toBe(false);
  });

  it('does not warn about duplicates across batches when only one is generated', () => {
    const s = { ...readySession(), kids: ['ANA POP'], teachers: ['ANA POP'] };
    expect(validateForGeneration(s, 'kids').warnings).toEqual([]);
    expect(validateForGeneration(s, 'all').warnings.some((w) => w.includes('ANA POP'))).toBe(true);
  });
});
