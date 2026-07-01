/**
 * bootstrap.test.ts — integration tests for bootstrapState (services/storage.ts)
 *
 * Tests the 4 critical boot-merge scenarios without hitting the network.
 * Supabase is mocked; localStorage is provided by vitest's jsdom environment.
 *
 * Scenarios:
 *  1. Cloud is newer  → cloud state returned; no saveCloud write-back triggered
 *  2. Local is newer  → local state returned; saveCloud write-back fired (void)
 *  3. Cloud fails all retries, local exists → local returned, no throw
 *  4. Cloud fails all retries, no local    → throws (bootForUser sets error state)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Chainable supabase mock ───────────────────────────────────────────────────
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock('../services/supabase', () => ({ supabase: { from: mockFrom } }));

import { bootstrapState } from '../services/storage';
import type { AppState } from '../types/workout';

// ── Helpers ───────────────────────────────────────────────────────────────────
const UID = 'bootstrap-test-user';
// Keys must match storage.ts exactly: localKey() and localTsKey()
const LOCAL_KEY    = `timo_training_v4__user__${UID}`;
const LOCAL_TS_KEY = `timo_training_v4__user__${UID}__savedAt`;

function makeState(label: string): AppState {
  return {
    schema: '4.1',
    weeks: [{
      week: 1, day: 'Monday' as const, date: '2026-02-16',
      exercises: [{
        id: 'ex1', name: label, type: 'single' as const, code: '',
        sets: [{ kg: '80', reps: '5', done: false, rpe: '' }],
        rest: '', note: '', recovery: false, recoveryDone: false,
        conditioning: false, conditioningNote: '', conditioningDone: false,
      }],
    }],
  };
}

/** Chainable mock where maybeSingle() resolves to `value`. */
function makeSelectChain(value: { data: any; error: any }) {
  const c: any = {};
  ['select', 'eq'].forEach(m => { c[m] = vi.fn().mockReturnValue(c); });
  c.maybeSingle = vi.fn().mockResolvedValue(value);
  return c;
}

/** Chain where upsert() resolves to `value`. */
function makeUpsertChain(value: { error: any }) {
  const c: any = { upsert: vi.fn().mockResolvedValue(value) };
  return c;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks(); // resets implementations AND call counts
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Scenario 1: Cloud is newer ────────────────────────────────────────────────
describe('Scenario 1: cloud state is newer than local', () => {
  it('returns the cloud state', async () => {
    const localState = makeState('local-exercise');
    const cloudState = makeState('cloud-exercise');

    localStorage.setItem(LOCAL_KEY, JSON.stringify(localState));
    localStorage.setItem(LOCAL_TS_KEY, '2026-01-01T08:00:00.000Z'); // older

    const selectChain = makeSelectChain({
      data: { state_json: cloudState, updated_at: '2026-01-01T10:00:00.000Z' }, // newer
      error: null,
    });
    mockFrom.mockReturnValue(selectChain);

    const result = await bootstrapState(UID);

    // Exercise name is preserved as-is (normalizeExerciseName does not auto-capitalize)
    expect(result.weeks[0].exercises[0].name).toBe('cloud-exercise');
    // maybeSingle called once (no write-back since cloud was already newer)
    expect(selectChain.maybeSingle).toHaveBeenCalledTimes(1);
  });
});

// ── Scenario 2: Local is newer ────────────────────────────────────────────────
describe('Scenario 2: local state is newer than cloud', () => {
  it('returns the local state and triggers a write-back to cloud', async () => {
    const localState = makeState('local-exercise');
    const cloudState = makeState('cloud-exercise');

    localStorage.setItem(LOCAL_KEY, JSON.stringify(localState));
    localStorage.setItem(LOCAL_TS_KEY, '2026-01-01T10:00:00.000Z'); // newer

    let callCount = 0;
    const selectChain = makeSelectChain({
      data: { state_json: cloudState, updated_at: '2026-01-01T08:00:00.000Z' }, // older
      error: null,
    });
    const upsertChain = makeUpsertChain({ error: null });

    mockFrom.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? selectChain : upsertChain;
    });

    const result = await bootstrapState(UID);

    expect(result.weeks[0].exercises[0].name).toBe('local-exercise');

    // Allow the fire-and-forget saveCloud to settle
    await new Promise(r => setTimeout(r, 0));

    // write-back must have been triggered
    expect(upsertChain.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = upsertChain.upsert.mock.calls[0][0];
    expect(upsertArg.user_id).toBe(UID);
  });
});

// ── Scenario 3: Cloud fails, local exists ─────────────────────────────────────
describe('Scenario 3: cloud fails on all retries, local data exists', () => {
  it('returns the local state without throwing', async () => {
    vi.useFakeTimers();

    localStorage.setItem(LOCAL_KEY, JSON.stringify(makeState('local-fallback')));
    localStorage.setItem(LOCAL_TS_KEY, '2026-01-01T08:00:00.000Z');

    const chain: any = {};
    ['select', 'eq'].forEach(m => { chain[m] = vi.fn().mockReturnValue(chain); });
    chain.maybeSingle = vi.fn().mockRejectedValue(new Error('network error'));
    mockFrom.mockReturnValue(chain);

    const promise = bootstrapState(UID);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.weeks[0].exercises[0].name).toBe('local-fallback');
  });
});

// ── Scenario 4: Cloud fails, no local ────────────────────────────────────────
describe('Scenario 4: cloud fails on all retries, no local data', () => {
  it('throws so bootForUser can set bootStatus=error', async () => {
    vi.useFakeTimers();

    // localStorage is empty — no prior local state

    const chain: any = {};
    ['select', 'eq'].forEach(m => { chain[m] = vi.fn().mockReturnValue(chain); });
    chain.maybeSingle = vi.fn().mockRejectedValue(new Error('network error'));
    mockFrom.mockReturnValue(chain);

    const promise = bootstrapState(UID);
    // Attach the rejection handler BEFORE advancing timers so the rejection
    // is caught by .rejects rather than surfacing as an unhandled rejection.
    const assertion = expect(promise).rejects.toThrow(/Failed to load training data/);
    await vi.runAllTimersAsync();
    await assertion;
  });
});
