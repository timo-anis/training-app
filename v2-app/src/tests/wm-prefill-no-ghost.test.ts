/**
 * wm-prefill-no-ghost.test.ts — last-session values are SUGGESTIONS.
 * Skipping an exercise (navigate past it untouched) must not write last session's
 * kg/reps into today's log; marking the set done accepts them; an explicit edit
 * is written. Also: an empty pinned day can always be ended.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';

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
import { emptyExercise, type AppState, type Exercise } from '../types/workout';

function ex(id: string, name: string, code: string, type: 'single' | 'superset', kg = '', reps = '', done = false): Exercise {
  const e = { ...emptyExercise(id, name), code, type };
  e.sets = [{ kg, reps, done, rpe: '' }];
  return e;
}

function seed() {
  const s: AppState = {
    schema: '4.1',
    weeks: [
      // last session: Bench 100 × 5 done
      { week: 1, day: 'Monday', date: '2026-01-05', exercises: [ex('p1', 'Bench', 'A1', 'superset', '100', '5', true), ex('p2', 'Row', 'A2', 'superset', '60', '8', true)] },
      // today: empty sets
      { week: 2, day: 'Monday', date: '2026-01-12', exercises: [ex('a1', 'Bench', 'A1', 'superset'), ex('a2', 'Row', 'A2', 'superset'), ex('b', 'Squat', 'B', 'single')] },
    ],
  };
  appState.set(s);
  uiState.update(u => ({ ...u, week: 2, day: 'Monday' }));
}

const today = () => get(appState).weeks.find(w => w.week === 2 && w.day === 'Monday')!;
const flush = async () => { await tick(); await tick(); };

beforeEach(() => { exitWorkout(); localStorage.clear(); seed(); openWorkoutMode(); });
afterEach(() => cleanup());

describe('last-session suggestions are not written unless accepted', () => {
  it('navigating past an untouched superset leaves today\'s sets empty', async () => {
    render(WorkoutMode); await flush();
    expect((document.querySelector('.exercises-wrap input') as HTMLInputElement | null)?.value).toBe('100'); // shown
    await fireEvent.click(screen.getByRole('button', { name: 'Next ›' })); await flush(); // A2
    await fireEvent.click(screen.getByRole('button', { name: 'Next ›' })); await flush(); // B (block change → commit)
    const [a1, a2] = today().exercises;
    expect(a1.sets[0]).toMatchObject({ kg: '', reps: '', done: false });
    expect(a2.sets[0]).toMatchObject({ kg: '', reps: '', done: false });
  });

  it('marking the set done accepts the suggested values', async () => {
    render(WorkoutMode); await flush();
    await fireEvent.click(screen.getByRole('button', { name: 'Mark set done' })); await flush();
    expect(today().exercises[0].sets[0]).toMatchObject({ kg: '100', reps: '5', done: true });
  });

  it('an explicit edit is committed on navigation', async () => {
    render(WorkoutMode); await flush();
    const kgInput = document.querySelector('.exercises-wrap input') as HTMLInputElement;
    await fireEvent.input(kgInput, { target: { value: '102.5' } }); await flush();
    await fireEvent.click(screen.getByRole('button', { name: 'Next ›' })); await flush();
    await fireEvent.click(screen.getByRole('button', { name: 'Next ›' })); await flush();
    expect(today().exercises[0].sets[0].kg).toBe('102.5');
    expect(today().exercises[0].sets[0].reps).toBe(''); // untouched suggestion not written
  });
});

describe('empty pinned day', () => {
  it('offers End workout, which ends the session', async () => {
    appState.update(s => ({ ...s, weeks: s.weeks.map(w => (w.week === 2 ? { ...w, exercises: [] } : w)) }));
    render(WorkoutMode); await flush();
    await fireEvent.click(screen.getByRole('button', { name: 'End workout' })); await flush();
    expect(get(uiState).workoutActive).toBe(false);
  });
});
