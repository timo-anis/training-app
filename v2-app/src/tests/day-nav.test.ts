/**
 * Tests for day navigation: goToAdjacentDay (week-boundary crossing + clamp) and goToToday.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), resetPasswordForEmail: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

import { uiState, currentUser, goToAdjacentDay, goToToday, todayWeekDay } from '../stores/app';

function setDay(week: number, day: string) {
  uiState.update(u => ({ ...u, week, day: day as any }));
}
const cur = () => { const u = get(uiState); return { week: u.week, day: u.day }; };

describe('goToAdjacentDay', () => {
  beforeEach(() => currentUser.set(null));

  it('moves forward within the same week', () => {
    setDay(16, 'Tuesday');
    goToAdjacentDay(1);
    expect(cur()).toEqual({ week: 16, day: 'Wednesday' });
  });

  it('crosses forward over the week boundary (Sunday -> next Monday)', () => {
    setDay(16, 'Sunday');
    goToAdjacentDay(1);
    expect(cur()).toEqual({ week: 17, day: 'Monday' });
  });

  it('crosses backward over the week boundary (Monday -> prev Sunday)', () => {
    setDay(16, 'Monday');
    goToAdjacentDay(-1);
    expect(cur()).toEqual({ week: 15, day: 'Sunday' });
  });

  it('clamps at program start (Week 1 Monday cannot go earlier)', () => {
    setDay(1, 'Monday');
    goToAdjacentDay(-1);
    expect(cur()).toEqual({ week: 1, day: 'Monday' });
  });
});

describe('goToToday', () => {
  beforeEach(() => currentUser.set(null));

  it('selects the program week/day matching today', () => {
    setDay(1, 'Monday');
    goToToday();
    const t = todayWeekDay();
    if (t) expect(cur()).toEqual({ week: t.week, day: t.day });
  });
});
