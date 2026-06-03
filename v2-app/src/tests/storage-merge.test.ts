import { describe, it, expect } from 'vitest';
import { chooseNewer } from '../lib/state-merge';
import type { AppState } from '../types/workout';

const withData = (): AppState => ({ weeks: [{} as never], schema: '4.0' });
const empty = (): AppState => ({ weeks: [], schema: '4.0' });

describe('chooseNewer (boot merge: newer wins, tie -> cloud)', () => {
  const T1 = '2026-06-01T10:00:00.000Z';
  const T2 = '2026-06-02T10:00:00.000Z';

  it('local newer than cloud -> local', () => {
    expect(chooseNewer(withData(), T2, withData(), T1).source).toBe('local');
  });
  it('cloud newer than local -> cloud', () => {
    expect(chooseNewer(withData(), T1, withData(), T2).source).toBe('cloud');
  });
  it('equal timestamps -> cloud (server is shared source of truth)', () => {
    expect(chooseNewer(withData(), T1, withData(), T1).source).toBe('cloud');
  });
  it('local has data+ts, cloud has data but no ts -> local wins', () => {
    expect(chooseNewer(withData(), T1, withData(), null).source).toBe('local');
  });
  it('pre-timestamp local (null ts) vs timestamped cloud -> cloud (legacy-safe)', () => {
    expect(chooseNewer(withData(), null, withData(), T1).source).toBe('cloud');
  });
  it('only cloud has data -> cloud', () => {
    expect(chooseNewer(empty(), null, withData(), T1).source).toBe('cloud');
  });
  it('only local has data -> local', () => {
    expect(chooseNewer(withData(), T1, empty(), T2).source).toBe('local');
  });
  it('neither has data -> none', () => {
    const r = chooseNewer(empty(), null, null, null);
    expect(r.source).toBe('none');
    expect(r.state).toBeNull();
  });
});
