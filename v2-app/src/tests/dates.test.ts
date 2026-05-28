/**
 * Tests for src/lib/dates.ts
 *
 * Critical coverage:
 * - Program start anchor (Week 1 Monday = 2026-02-16)
 * - DST boundary (Europe spring-forward: March 28–29, 2026)
 * - Week boundary arithmetic
 * - Round-trip: getDateForWeekDay ↔ getWeekDayForDate
 */

import { describe, it, expect } from 'vitest';
import { getDateForWeekDay, getWeekDayForDate } from '../lib/dates';

describe('getDateForWeekDay', () => {
  // ── Anchor: program start ────────────────────────────────────────────────
  it('Week 1 Monday = PROGRAM_START (2026-02-16)', () => {
    expect(getDateForWeekDay(1, 'Monday')).toBe('2026-02-16');
  });

  it('Week 1 Tuesday = 2026-02-17', () => {
    expect(getDateForWeekDay(1, 'Tuesday')).toBe('2026-02-17');
  });

  it('Week 1 Sunday = 2026-02-22', () => {
    expect(getDateForWeekDay(1, 'Sunday')).toBe('2026-02-22');
  });

  // ── Week boundaries ──────────────────────────────────────────────────────
  it('Week 2 Monday starts the day after Week 1 Sunday', () => {
    expect(getDateForWeekDay(2, 'Monday')).toBe('2026-02-23');
  });

  it('Week 2 Sunday = 2026-03-01', () => {
    expect(getDateForWeekDay(2, 'Sunday')).toBe('2026-03-01');
  });

  // ── DST boundary (Europe springs forward: 2026-03-29 02:00 → 03:00) ──────
  // DST boundary falls inside Week 6 (2026-03-23 – 2026-03-29).
  // If using local-time arithmetic, dates around this boundary would shift by 1 day.
  it('Week 6 Saturday = 2026-03-28 (day before DST change)', () => {
    expect(getDateForWeekDay(6, 'Saturday')).toBe('2026-03-28');
  });

  it('Week 6 Sunday = 2026-03-29 (DST spring-forward day) — must not shift', () => {
    expect(getDateForWeekDay(6, 'Sunday')).toBe('2026-03-29');
  });

  it('Week 7 Monday = 2026-03-30 (first day after DST week)', () => {
    expect(getDateForWeekDay(7, 'Monday')).toBe('2026-03-30');
  });

  // ── Further weeks ────────────────────────────────────────────────────────
  it('Week 10 Monday = 2026-04-20', () => {
    expect(getDateForWeekDay(10, 'Monday')).toBe('2026-04-20');
  });

  it('Week 15 Friday = 2026-05-29', () => {
    expect(getDateForWeekDay(15, 'Friday')).toBe('2026-05-29');
  });
});

describe('getWeekDayForDate', () => {
  // ── Anchor ───────────────────────────────────────────────────────────────
  it('2026-02-16 → Week 1 Monday', () => {
    expect(getWeekDayForDate('2026-02-16')).toEqual({ week: 1, day: 'Monday' });
  });

  it('2026-02-22 → Week 1 Sunday', () => {
    expect(getWeekDayForDate('2026-02-22')).toEqual({ week: 1, day: 'Sunday' });
  });

  it('2026-02-23 → Week 2 Monday', () => {
    expect(getWeekDayForDate('2026-02-23')).toEqual({ week: 2, day: 'Monday' });
  });

  // ── DST dates — DST boundary is inside Week 6 ────────────────────────────
  it('2026-03-28 → Week 6 Saturday (day before DST change)', () => {
    expect(getWeekDayForDate('2026-03-28')).toEqual({ week: 6, day: 'Saturday' });
  });

  it('2026-03-29 (DST day) → Week 6 Sunday — must not shift to wrong week', () => {
    expect(getWeekDayForDate('2026-03-29')).toEqual({ week: 6, day: 'Sunday' });
  });

  it('2026-03-30 → Week 7 Monday (first day after DST week)', () => {
    expect(getWeekDayForDate('2026-03-30')).toEqual({ week: 7, day: 'Monday' });
  });

  // ── Before program start → null ──────────────────────────────────────────
  it('2026-02-15 (day before program start) → null', () => {
    expect(getWeekDayForDate('2026-02-15')).toBeNull();
  });

  it('2020-01-01 (far in the past) → null', () => {
    expect(getWeekDayForDate('2020-01-01')).toBeNull();
  });

  // ── Round-trips ──────────────────────────────────────────────────────────
  const roundTripCases: Array<[number, import('../types/workout').DayOfWeek]> = [
    [1, 'Monday'],
    [1, 'Sunday'],
    [2, 'Wednesday'],
    [5, 'Thursday'],
    [6, 'Saturday'],  // 2026-03-28, day before DST
    [6, 'Sunday'],    // 2026-03-29, DST spring-forward day
    [7, 'Monday'],    // 2026-03-30, first day after DST week
    [12, 'Friday'],
  ];

  for (const [week, day] of roundTripCases) {
    it(`round-trip: Week ${week} ${day}`, () => {
      const date = getDateForWeekDay(week, day);
      expect(getWeekDayForDate(date)).toEqual({ week, day });
    });
  }
});
