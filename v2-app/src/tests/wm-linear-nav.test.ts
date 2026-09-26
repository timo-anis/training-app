/**
 * wm-linear-nav.test.ts — WorkoutMode wiring of linear navigation (component).
 * Superset A (A1 Bench, A2 Row) → single B (Squat). Next/Prev in the footer and
 * the superset › ‹ arrows must walk A1 → A2 → B and back; the footer has no "Back"
 * and shows Finish only on the last exercise.
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
import { emptyExercise, type AppState } from '../types/workout';

function seed() {
  const a1 = { ...emptyExercise('a1', 'Bench'), type: 'superset' as const, code: 'A1' };
  const a2 = { ...emptyExercise('a2', 'Row'), type: 'superset' as const, code: 'A2' };
  const b = { ...emptyExercise('b', 'Squat'), code: 'B' };
  const s: AppState = { weeks: [{ week: 1, day: 'Monday', date: '2026-01-05', exercises: [a1, a2, b] }], schema: '4.1' };
  appState.set(s);
  uiState.update(u => ({ ...u, week: 1, day: 'Monday' }));
}

const shownName = () => (document.querySelector('.exercises-wrap')?.textContent ?? '');
const flush = async () => { await tick(); await tick(); };

beforeEach(() => { exitWorkout(); localStorage.clear(); seed(); openWorkoutMode(); });
afterEach(() => cleanup());

describe('WorkoutMode linear navigation', () => {
  it('footer Next: A1 → A2 → B (leaves the superset), then Finish', async () => {
    render(WorkoutMode); await flush();
    expect(shownName()).toContain('Bench');
    expect(screen.queryByRole('button', { name: /Back/ })).toBeNull();          // no footer Back
    await fireEvent.click(screen.getByRole('button', { name: 'Next ›' })); await flush();
    expect(shownName()).toContain('Row');
    await fireEvent.click(screen.getByRole('button', { name: 'Next ›' })); await flush();
    expect(get(uiState).activeExerciseIndex).toBe(1);
    expect(shownName()).toContain('Squat');
    expect(screen.queryByRole('button', { name: 'Next ›' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Finish ✓' })).toBeTruthy();
  });

  it('footer Prev works on A2 of the first block, and from B lands on A2', async () => {
    render(WorkoutMode); await flush();
    const prevBtn = () => screen.getByRole('button', { name: '‹ Prev' }) as HTMLButtonElement;
    expect(prevBtn().disabled).toBe(true);                                      // A1 = very first
    await fireEvent.click(screen.getByRole('button', { name: 'Next ›' })); await flush(); // A2
    expect(prevBtn().disabled).toBe(false);
    await fireEvent.click(screen.getByRole('button', { name: 'Next ›' })); await flush(); // B
    await fireEvent.click(prevBtn()); await flush();
    expect(get(uiState).activeExerciseIndex).toBe(0);
    expect(shownName()).toContain('Row');                                        // entered A on its LAST member
  });

  it('superset › arrow on A2 moves on to the next exercise (B)', async () => {
    render(WorkoutMode); await flush();
    const nextArrow = () => screen.getByRole('button', { name: 'Next exercise' });
    await fireEvent.click(nextArrow()); await flush();                            // A1 → A2
    expect(shownName()).toContain('Row');
    await fireEvent.click(nextArrow()); await flush();                            // A2 → B
    expect(get(uiState).activeExerciseIndex).toBe(1);
    expect(shownName()).toContain('Squat');
  });
});
