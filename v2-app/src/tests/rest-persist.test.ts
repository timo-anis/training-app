import { describe, it, expect } from 'vitest';
import { decodeRestBlob, restBlobUsable, encodeRestBlob } from '../lib/rest-persist';

describe('decodeRestBlob — localStorage blob parsing', () => {
  it('round-trips encode -> decode with the advance flag', () => {
    const raw = encodeRestBlob(1000, 90, true);
    expect(decodeRestBlob(raw)).toEqual({ s: 1000, t: 90, adv: true });
  });
  it('decodes a legacy {s,t} blob (pre-adv) with adv=false', () => {
    expect(decodeRestBlob(JSON.stringify({ s: 5, t: 60 }))).toEqual({ s: 5, t: 60, adv: false });
  });
  it('returns null for null / empty / corrupt raw values', () => {
    expect(decodeRestBlob(null)).toBeNull();
    expect(decodeRestBlob('')).toBeNull();
    expect(decodeRestBlob('not json')).toBeNull();
    expect(decodeRestBlob('{"s":"x","t":60}')).toBeNull();
  });
  it('rejects non-finite or non-positive durations', () => {
    expect(decodeRestBlob(JSON.stringify({ s: 1, t: 0 }))).toBeNull();
    expect(decodeRestBlob(JSON.stringify({ s: 1, t: -5 }))).toBeNull();
  });
  it('never trusts a truthy-but-non-boolean adv', () => {
    expect(decodeRestBlob(JSON.stringify({ s: 1, t: 60, adv: 'yes' }))?.adv).toBe(false);
  });
});

describe('restBlobUsable — grace window', () => {
  const blob = { s: 0, t: 60, adv: false };
  it('usable while the timer is still running', () => {
    expect(restBlobUsable(blob, 30_000)).toBe(true);
  });
  it('usable within the 120s grace window after expiry (GO! state)', () => {
    expect(restBlobUsable(blob, (60 + 119) * 1000)).toBe(true);
  });
  it('stale once past the grace window', () => {
    expect(restBlobUsable(blob, (60 + 121) * 1000)).toBe(false);
  });
});
