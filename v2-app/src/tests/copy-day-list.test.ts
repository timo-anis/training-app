/**
 * Behavioural tests for the CopyDaySheet week accordion.
 *
 * The option list is grouped by week: collapsed by default (one header per
 * week), each header expands to that week's days. A search box narrows the
 * list and auto-expands weeks that contain a match. These tests lock in:
 *   - collapsed-by-default (no day options shown until a week is opened),
 *   - one header per week for the full history (no 30-item cap),
 *   - expanding a week reveals its day(s),
 *   - search auto-expands matching weeks and filters days
 *     (by week number / month / exercise name),
 *   - selecting a day still enables + wires the confirm button,
 *   - the no-match empty state.
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

// 40 weeks, one Monday each => 40 week groups (> the old 30-item cap).
// Weeks 1-4 dated January, 5-8 February, etc. (4 weeks/month) so search-by-month
// is exercised. Week 3 gets a unique exercise name to search by.
function seed(): AppState {
  const weeks: WorkoutDay[] = [];
  for (let w = 1; w <= 40; w++) {
    const iso = `2026-${String(1 + Math.floor((w - 1) / 4)).padStart(2, '0')}-05`;
    weeks.push({ week: w, day: 'Monday', date: iso, exercises: [ex(`Squat wk${w}`)] });
  }
  weeks[2].exercises = [ex('Deadlift special')];
  return { schema: '4.1', userStartWeek: 1, weeks };
}

const props = { week: 50, day: 'Monday' as const };
const weekTitles = () => screen.getAllByText(/^Week \d+$/);

describe('CopyDaySheet week accordion', () => {
  beforeEach(() => appState.set(seed()));

  it('is collapsed by default: one header per week, no day options shown', () => {
    render(CopyDaySheet, { props });
    expect(weekTitles().length).toBe(40);           // one header per past week
    expect(screen.queryAllByRole('option').length).toBe(0); // nothing expanded yet
    expect(screen.getByText('Week 1')).toBeInTheDocument();   // oldest present
    expect(screen.getByText('Week 40')).toBeInTheDocument();  // newest present
  });

  it('expanding a week reveals its day', async () => {
    render(CopyDaySheet, { props });
    await fireEvent.click(screen.getByText('Week 1'));
    const opts = screen.getAllByRole('option');
    expect(opts.length).toBe(1);
    expect(within(opts[0]).getByText(/Monday/)).toBeInTheDocument();
  });

  it('collapses again on a second tap', async () => {
    render(CopyDaySheet, { props });
    await fireEvent.click(screen.getByText('Week 1'));
    expect(screen.getAllByRole('option').length).toBe(1);
    await fireEvent.click(screen.getByText('Week 1'));
    expect(screen.queryAllByRole('option').length).toBe(0);
  });

  it('search auto-expands matching weeks and shows only matching days (month)', async () => {
    render(CopyDaySheet, { props });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'feb' } });
    // Weeks 5-8 dated 2026-02 → 4 week groups, each auto-expanded with its day
    expect(weekTitles().length).toBe(4);
    expect(screen.getAllByRole('option').length).toBe(4);
  });

  it('search matches exercise name and auto-expands that week', async () => {
    render(CopyDaySheet, { props });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'deadlift' } });
    expect(weekTitles().length).toBe(1);
    const opts = screen.getAllByRole('option');
    expect(opts.length).toBe(1);
    expect(screen.getByText('Week 3')).toBeInTheDocument();
  });

  it('search matches a specific week number', async () => {
    render(CopyDaySheet, { props });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'week 40' } });
    expect(weekTitles().length).toBe(1);
    expect(screen.getByText('Week 40')).toBeInTheDocument();
  });

  it('selecting a day enables the confirm button', async () => {
    render(CopyDaySheet, { props });
    expect(screen.getByRole('button', { name: /select a day/i })).toBeDisabled();
    await fireEvent.click(screen.getByText('Week 1'));
    await fireEvent.click(screen.getByRole('option'));
    expect(screen.getByRole('button', { name: /copy \d+ exercise/i })).toBeEnabled();
  });

  it('shows a no-match message when nothing matches', async () => {
    render(CopyDaySheet, { props });
    await fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'zzzznope' } });
    expect(screen.queryAllByText(/^Week \d+$/).length).toBe(0);
    expect(screen.getByText(/No days match/)).toBeInTheDocument();
  });
});
