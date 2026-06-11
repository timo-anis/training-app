/**
 * Date ↔ week/day arithmetic — single source of truth.
 *
 * All conversions use UTC milliseconds (Date.UTC) to avoid DST issues.
 * PROGRAM_START = Monday 2026-02-16 (PS_UTC)
 *
 * Week 1 = 2026-02-16 … 2026-02-22
 * Week 2 = 2026-02-23 … 2026-03-01
 * …
 */

import { PS_UTC } from './program';
import { DAY_ORDER } from '../types/workout';
import type { DayOfWeek } from '../types/workout';

/** Day-of-week → offset from Monday (0 = Mon, 6 = Sun) */
export const DAY_OFFSET: Record<DayOfWeek, number> = {
  Monday: 0,
  Tuesday: 1,
  Wednesday: 2,
  Thursday: 3,
  Friday: 4,
  Saturday: 5,
  Sunday: 6,
};

/**
 * Convert week number + day-of-week to ISO date string ('YYYY-MM-DD').
 * Uses UTC arithmetic so the result is identical regardless of local timezone or DST.
 */
export function getDateForWeekDay(week: number, day: DayOfWeek): string {
  const utc = PS_UTC + ((week - 1) * 7 + DAY_OFFSET[day]) * 86400000;
  const d = new Date(utc);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Convert an ISO date string ('YYYY-MM-DD') to { week, day }.
 * Returns null for dates before PROGRAM_START.
 */
export function getWeekDayForDate(date: string): { week: number; day: DayOfWeek } | null {
  const [y, mo, d] = date.split('-').map(Number);
  const diff = Math.round((Date.UTC(y, mo - 1, d) - PS_UTC) / 86400000);
  if (diff < 0) return null;
  const week = Math.floor(diff / 7) + 1;
  const day = DAY_ORDER[diff % 7];
  return { week, day };
}

/**
 * week + day -> Date whose UTC fields hold the program calendar date (UTC midnight).
 * Use when reading getUTCFullYear/getUTCMonth (e.g. month bucketing).
 */
export function weekDayToUTCDate(week: number, day: DayOfWeek): Date {
  return new Date(PS_UTC + ((week - 1) * 7 + DAY_OFFSET[day]) * 86400000);
}

/**
 * week + day -> Date at LOCAL midnight of that calendar date.
 * Use for calendar-grid placement and "today" comparisons in local time.
 */
export function weekDayToLocalDate(week: number, day: DayOfWeek): Date {
  const d = weekDayToUTCDate(week, day);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * A local Date -> { week, day }, or null for dates before PROGRAM_START.
 * Mirror of getWeekDayForDate for callers that already hold a Date object.
 */
export function localDateToWeekDay(date: Date): { week: number; day: DayOfWeek } | null {
  const diff = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - PS_UTC) / 86400000);
  if (diff < 0) return null;
  return { week: Math.floor(diff / 7) + 1, day: DAY_ORDER[diff % 7] };
}
