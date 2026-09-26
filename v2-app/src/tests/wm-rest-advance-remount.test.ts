/**
 * wm-rest-advance-remount.test.ts — regression: quick out-and-back during rest.
 *
 * Leaving workout mode mid-rest unmounts WorkoutMode; coming back (bar "Rest m:ss →")
 * remounts it. maybeRestoreRestTimer recovers the superset auto-advance flag from the
 * persisted blob, but the block-nav $effect's first run on mount used to reset it to
 * false (and the persist effect then wrote adv:false back) — so the superset no longer
 * advanced when the rest ended. The flag must survive the remount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

import WorkoutMode from '../components/WorkoutMode.svelte';
import { appState, uiState, openWorkoutMode, exitWorkout } from '../stores/app';
import { emptyExercise, type AppState } from '../types/workout';
import { REST_PERSIST_KEY, decodeRestBlob } from '../lib/rest-persist';

function seedSuperset() {
  const a1 = { ...emptyExercise('a1', 'Bench'), type: 'superset' as const, code: 'A1', rest: '1:30' };
  const a2 = { ...emptyExercise('a2', 'Row'), type: 'superset' as const, code: 'A2', rest: '1:30' };
  a1.sets = [{ kg: '80', reps: '5', done: true, rpe: '' }, { kg: '80', reps: '5', done: false, rpe: '' }];
  a2.sets = [{ kg: '60', reps: '8', done: false, rpe: '' }, { kg: '60', reps: '8', done: false, rpe: '' }];
  const s: AppState = { weeks: [{ week: 1, day: 'Monday', date: '2026-01-05', exercises: [a1, a2] }], schema: '4.1' };
  appState.set(s);
  uiState.update(u => ({ ...u, week: 1, day: 'Monday' }));
}

beforeEach(() => {
  exitWorkout();
  localStorage.clear();
  seedSuperset();
});
afterEach(() => cleanup());

describe('WorkoutMode remount during rest', () => {
  it('keeps the superset auto-advance flag recovered from the persisted rest blob', async () => {
    const start = Date.now() - 10_000;
    openWorkoutMode();
    // Rest running in the store + persisted blob with adv:true (set by marking an A1 set done)
    uiState.update(u => ({ ...u, restStartTime: start, restTotal: 90 }));
    localStorage.setItem(REST_PERSIST_KEY, JSON.stringify({ s: start, t: 90, adv: true }));

    render(WorkoutMode);
    await tick(); await tick();

    const blob = decodeRestBlob(localStorage.getItem(REST_PERSIST_KEY));
    expect(blob).not.toBeNull();
    expect(blob!.adv).toBe(true);
  });
});
