/**
 * storage.test.ts — unit tests for services/storage.ts
 *
 * Strategy: mock supabase so we test our logic, not the network.
 * localStorage is provided by vitest's jsdom environment.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Supabase mock ─────────────────────────────────────────────────────────────
// vi.mock factories are hoisted to the top of the file, so mockFrom must be
// declared with vi.hoisted() to be available inside the factory.
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock('../services/supabase', () => ({
  supabase: { from: mockFrom },
}));

// ── Import after mocking ───────────────────────────────────────────────────────
import {
  loadLocal,
  saveLocal,
  loadLocalTimestamp,
  saveCloud,
  setBootCloudTs,
} from '../services/storage';
import type { AppState } from '../types/workout';
import { emptyAppState } from '../types/workout';

// ── Helpers ───────────────────────────────────────────────────────────────────
function stateWithWeeks(count = 1): AppState {
  const weeks = Array.from({ length: count }, (_, i) => ({
    week: i + 1,
    day: 'Monday' as const,
    date: '2026-02-16',
    exercises: [
      {
        id: `ex_${i}`, name: 'Squat', type: 'single' as const, code: '',
        sets: [{ kg: '100', reps: '5', done: false, rpe: '' }],
        rest: '', note: '', recovery: false, recoveryDone: false,
        conditioning: false, conditioningNote: '', conditioningDone: false,
      },
    ],
  }));
  return { schema: '4.1', weeks };
}

function userId() { return 'test-user-abc'; }

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // D1: reset OCC cursor so saveCloud tests always exercise the first-save path.
  setBootCloudTs(null);
});

afterEach(() => vi.restoreAllMocks());

// ── loadLocal / saveLocal ─────────────────────────────────────────────────────
describe('loadLocal / saveLocal', () => {
  it('returns null when nothing stored', () => {
    expect(loadLocal(userId())).toBeNull();
  });

  it('round-trips an AppState through localStorage', () => {
    const state = stateWithWeeks(2);
    expect(saveLocal(userId(), state)).toBe(true);
    const loaded = loadLocal(userId());
    expect(loaded).not.toBeNull();
    expect(loaded!.weeks).toHaveLength(2);
    expect(loaded!.schema).toBe('4.1');
  });

  it('isolates state by userId', () => {
    saveLocal('user-A', stateWithWeeks(1));
    saveLocal('user-B', stateWithWeeks(3));
    expect(loadLocal('user-A')!.weeks).toHaveLength(1);
    expect(loadLocal('user-B')!.weeks).toHaveLength(3);
  });

  it('returns null for corrupted localStorage JSON', () => {
    localStorage.setItem('timo_training_v4__user__bad', '{not valid json}');
    // loadLocal for a different key — just confirm it doesn't throw
    expect(() => loadLocal('bad')).not.toThrow();
  });
});

describe('loadLocalTimestamp', () => {
  it('returns null before any save', () => {
    expect(loadLocalTimestamp(userId())).toBeNull();
  });

  it('returns an ISO string after saveLocal', () => {
    saveLocal(userId(), stateWithWeeks());
    const ts = loadLocalTimestamp(userId());
    expect(ts).not.toBeNull();
    expect(new Date(ts!).getTime()).toBeGreaterThan(0);
  });
});

// ── saveCloud ─────────────────────────────────────────────────────────────────
describe('saveCloud', () => {
  function mockUpsert(error: any = null, data: any = null) {
    // D1: saveCloud now chains .upsert({}).select('updated_at')
    // Build a chain: from() -> { upsert() -> chain } -> { select() -> Promise }
    const chain: any = {};
    chain.upsert = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockResolvedValue({ data, error });
    mockFrom.mockReturnValue(chain);
    return chain;
  }

  it('returns false and does NOT call supabase when state has no weeks', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await saveCloud(userId(), emptyAppState());
    expect(result).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('blocked'));
  });

  it('returns false and does NOT call supabase for state with empty weeks array', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const empty = { schema: '4.1' as const, weeks: [] };
    expect(await saveCloud(userId(), empty)).toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('returns true on successful upsert', async () => {
    mockUpsert(null);
    const result = await saveCloud(userId(), stateWithWeeks());
    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('app_state');
  });

  it('returns false and logs on supabase error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // D1: first-save path uses .upsert().select() — both must be in the chain
    const chain: any = {};
    chain.upsert = vi.fn().mockReturnValue(chain);
    chain.select = vi.fn().mockResolvedValue({ data: null, error: new Error('network fail') });
    mockFrom.mockReturnValue(chain);
    const result = await saveCloud(userId(), stateWithWeeks());
    expect(result).toBe(false);
    expect(errSpy).toHaveBeenCalled();
  });
});
