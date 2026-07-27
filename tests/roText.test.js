// tests/roText.test.js
import { describe, it, expect } from 'vitest';
import { countedNoun } from '../src/shared/roText.js';

describe('countedNoun', () => {
  it('uses the singular for one', () => {
    expect(countedNoun(1, 'nume găsit', 'nume găsite')).toBe('1 nume găsit');
  });

  it('joins without "de" below twenty', () => {
    expect(countedNoun(0, 'nume', 'nume')).toBe('0 nume');
    expect(countedNoun(2, 'nume găsit', 'nume găsite')).toBe('2 nume găsite');
    expect(countedNoun(19, 'nume', 'nume')).toBe('19 nume');
  });

  it('joins with "de" from twenty up', () => {
    expect(countedNoun(20, 'nume', 'nume')).toBe('20 de nume');
    expect(countedNoun(34, 'nume găsit', 'nume găsite')).toBe('34 de nume găsite');
    expect(countedNoun(100, 'nume', 'nume')).toBe('100 de nume');
    expect(countedNoun(120, 'nume', 'nume')).toBe('120 de nume');
  });

  // 101–119 drop the "de" again, like 1–19 do.
  it('follows the last two digits, not the size of the number', () => {
    expect(countedNoun(101, 'nume', 'nume')).toBe('101 nume');
    expect(countedNoun(115, 'nume', 'nume')).toBe('115 nume');
    expect(countedNoun(121, 'nume', 'nume')).toBe('121 de nume');
  });
});
