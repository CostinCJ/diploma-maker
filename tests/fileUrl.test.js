// tests/fileUrl.test.js
import { describe, it, expect } from 'vitest';
import { fileUrl } from '../src/shared/fileUrl.js';

describe('fileUrl', () => {
  it('returns an empty string for empty input', () => {
    expect(fileUrl('')).toBe('');
    expect(fileUrl(undefined)).toBe('');
  });

  it('converts a Windows path to a file URL', () => {
    expect(fileUrl('C:\\Users\\Ana\\bg.jpg')).toBe('file:///C:/Users/Ana/bg.jpg');
  });

  it('keeps POSIX paths to a single leading slash (dev runs on Linux/macOS)', () => {
    expect(fileUrl('/home/ana/bg.jpg')).toBe('file:///home/ana/bg.jpg');
  });

  it('percent-encodes spaces and diacritics', () => {
    expect(fileUrl('C:\\Poze Tabără\\bg.jpg')).toBe('file:///C:/Poze%20Tab%C4%83r%C4%83/bg.jpg');
  });

  it('escapes # and ? so they cannot truncate the path', () => {
    expect(fileUrl('C:\\a#1\\b?c.png')).toBe('file:///C:/a%231/b%3Fc.png');
  });
});
