/**
 * Behavioural tests for the CopyDaySheet option list.
 *
 * Regression: the list used to `.slice(0, 30)`, so with a long training history
 * the older weeks (e.g. February) fell off and could not be copied. The list is
 * now uncapped and has a search box. These tests lock in:
 *   - every past day with exercises is listed (no 30-item cap), and
 *   - the search box narrows by week / weekday / month / exercise name.
 */
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

import CopyDaySheet from '../components/CopyDaySheet.svelte';
import { appState } from '../stores/app';
import type { Exercise, WorkoutDay, AppState } from '../types/workout';

function ex(name: string): Exercise {
  return {
    id: name, name, type: 'single', code: '',
    sets: [{ kg: '80', reps: '5', done: false, rpe: '' }],
    rest: '', note: '', recovery: false, recoveryDone: false,
    conditioning: false, conditioningNote: '', conditioningDone: false,
  };
}

// 40 non-empty days (weeks 1..40, Monday each) => more than the old 30 cap.
// Weeks 1-4 are dated January, weeks 5-8 February, etc. (4 weeks/month) so we
// can prove old weeks survive the removed cap and search-by-month works.
function seed(): AppState {
  const weeks: WorkoutDay[] = [];
  for (let w = 1; w <= 40; w++) {
    const iso = `2026-${String(1 + Math.floor((w - 1) / 4)).padStart(2, '0')}-05`;
    weeks.push({ week: w, day: 'Monday', date: iso, exercises: [ex(`Squat wk${w}`)] });
  }
  // give week 3 a Deadlift so we can search an exercise name uniquely
  weeks[2].exercises = [ex('Deadlift special')];
  return { schema: '4.1', userStartWeek: 1, weeks };
}

describe('CopyDaySheet list — uncapped + searchable', () => {
  beforeEach(() => appState.set(seed()));

  it('lists old weeks that used to be dropped by the 30-item cap', () => {
    render(CopyDaySheet, { props: { week: 50, day: 'Monday' } });
    expect(screen.getAllByRole('option').length).toBe(40);
    expect(screen.getByText(/Week 1 —/)).toBeInTheDocument();   // oldest (January)
    expect(screen.getByText(/Week 40 —/)).toBeInTheDocument();  // newest
  });

  it('search narrows by week number', async () => {
    render(CopyDaySheet, { props: { week: 50, day: 'Monday' } });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'Week 1 —' } });
    const opts = screen.getAllByRole('option');
    expect(opts.length).toBe(1);
    expect(within(opts[0]).getByText(/Week 1 —/)).toBeInTheDocument();
  });

  it('search matches month name via the date label', async () => {
    render(CopyDaySheet, { props: { week: 50, day: 'Monday' } });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'feb' } });
    // Weeks 5-8 are dated 2026-02-05 → 4 matches
    const opts = screen.getAllByRole('option');
    expect(opts.length).toBe(4);
  });

  it('search matches exercise name', async () => {
    render(CopyDaySheet, { props: { week: 50, day: 'Monday' } });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'deadlift' } });
    const opts = screen.getAllByRole('option');
    expect(opts.length).toBe(1);
    expect(within(opts[0]).getByText(/Week 3 —/)).toBeInTheDocument();
  });

  it('selecting a day still enables the confirm button', async () => {
    render(CopyDaySheet, { props: { week: 50, day: 'Monday' } });
    expect(screen.getByRole('button', { name: /select a day/i })).toBeDisabled();
    await fireEvent.click(screen.getByText(/Week 1 —/));
    expect(screen.getByRole('button', { name: /copy \d+ exercise/i })).toBeEnabled();
  });

  it('shows a no-match message when the query matches nothing', async () => {
    render(CopyDaySheet, { props: { week: 50, day: 'Monday' } });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'zzzznope' } });
    expect(screen.queryAllByRole('option').length).toBe(0);
    expect(screen.getByText(/No days match/)).toBeInTheDocument();
  });
});
