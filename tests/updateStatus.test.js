import { describe, it, expect } from 'vitest';
import { describeUpdate } from '../src/shared/updateStatus.js';

describe('describeUpdate', () => {
  it('says nothing while checking, when up to date, or on an unknown state', () => {
    expect(describeUpdate({ state: 'checking' })).toBe(null);
    expect(describeUpdate({ state: 'idle' })).toBe(null);
    expect(describeUpdate({ state: 'something-new' })).toBe(null);
    expect(describeUpdate(undefined)).toBe(null);
  });

  it('offers the download, and never starts it by itself', () => {
    const info = describeUpdate({ state: 'available', version: '1.3.0' });
    expect(info.action).toBe('download');
    expect(info.text).toContain('1.3.0');
    expect(info.dismissible).toBe(true);
  });

  it('names the version only when it knows it', () => {
    expect(describeUpdate({ state: 'available' }).text).toContain('O versiune nouă');
  });

  it('shows progress, and cannot be dismissed mid-download', () => {
    const info = describeUpdate({ state: 'downloading', percent: 42.6 });
    expect(info.text).toContain('43%');
    expect(info.action).toBe(null);
    expect(info.dismissible).toBe(false);
  });

  it('leaves out the percentage until the first progress report', () => {
    expect(describeUpdate({ state: 'downloading' }).text).not.toMatch(/\d/);
  });

  it('keeps a percentage inside 0–100', () => {
    expect(describeUpdate({ state: 'downloading', percent: 128 }).text).toContain('100%');
    expect(describeUpdate({ state: 'downloading', percent: -5 }).text).toContain('0%');
  });

  it('asks for the restart once the update is downloaded', () => {
    const info = describeUpdate({ state: 'ready', version: '1.3.0' });
    expect(info.action).toBe('install');
    expect(info.text).toContain('1.3.0');
  });

  it('reports a failed download with its reason', () => {
    const info = describeUpdate({ state: 'error', message: 'net::ERR_INTERNET_DISCONNECTED' });
    expect(info.text).toContain('net::ERR_INTERNET_DISCONNECTED');
    expect(info.action).toBe(null);
    expect(info.dismissible).toBe(true);
  });
});
