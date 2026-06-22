import { describe, it, expect } from 'vitest';
import { relativeAge } from '../lib/freshness';

describe('relativeAge — honest freshness label', () => {
  const now = Date.parse('2026-06-22T12:00:00Z');

  it('returns "never" for null', () => {
    expect(relativeAge(null, now)).toBe('never');
  });

  it('returns "unknown" for an invalid date', () => {
    expect(relativeAge('not-a-date', now)).toBe('unknown');
  });

  it('says "just now" under ~45s', () => {
    expect(relativeAge('2026-06-22T11:59:30Z', now)).toBe('just now');
  });

  it('renders minutes', () => {
    expect(relativeAge('2026-06-22T11:50:00Z', now)).toBe('10m ago');
  });

  it('renders hours', () => {
    expect(relativeAge('2026-06-22T09:00:00Z', now)).toBe('3h ago');
  });

  it('renders days', () => {
    expect(relativeAge('2026-06-19T12:00:00Z', now)).toBe('3d ago');
  });

  it('renders weeks', () => {
    expect(relativeAge('2026-06-08T12:00:00Z', now)).toBe('2w ago');
  });

  it('never shows a future negative age as anything but "just now"', () => {
    expect(relativeAge('2026-06-22T12:05:00Z', now)).toBe('just now');
  });
});
