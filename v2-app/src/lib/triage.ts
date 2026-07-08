/**
 * Coach dashboard triage — pure, testable "who needs attention" derivation.
 *
 * Signals per trainee (all computed from data already on the dashboard):
 *  - missed: planned days THIS program week that already passed untrained
 *    (assignment anchors vs trigger-maintained trained_dates; today is never
 *    "missed" — the day isn't over).
 *  - quiet: no training for >= QUIET_DAYS days (needs a lastTrainedAt).
 *  - noSessions: linked but no trained day on record at all.
 *
 * Unread chat is deliberately NOT part of the score: it already has its own
 * badge, and a realtime unread bump must never re-sort the list under the
 * coach's finger (adversarial finding, loop 2).
 *
 * Week→date arithmetic reuses lib/dates.ts (PROGRAM_START anchored); never
 * re-derive calendars here. "Today" is the coach's local date — for a coach
 * and trainee in far-apart timezones a day can flag "missed" a few hours
 * early/late around midnight; known v1 trade-off.
 */
import { getDateForWeekDay, getWeekDayForDate } from './dates';
import type { DayOfWeek } from '../types/workout';

/** Days without training before a trainee counts as "quiet". */
export const QUIET_DAYS = 4;

export interface PlanAnchor { week: number; day: string; }

export interface TriageFlags {
  /** ISO dates of planned-but-untrained days this program week (past only). */
  missed: string[];
  /** Full days since last trained, when >= QUIET_DAYS; otherwise null. */
  quietDays: number | null;
  /** Linked but zero trained days on record. */
  noSessions: boolean;
  score: number;
}

/** Monday (ISO date) of the program week containing `todayISO`, or null when
 *  today is before PROGRAM_START (nothing can be "missed" yet). */
export function programWeekMonday(todayISO: string): string | null {
  const wd = getWeekDayForDate(todayISO);
  return wd ? getDateForWeekDay(wd.week, 'Monday') : null;
}

/** Planned days this program week that already passed without a trained day. */
export function missedPlannedDates(
  anchors: PlanAnchor[], trainedDates: string[], todayISO: string
): string[] {
  const monday = programWeekMonday(todayISO);
  if (!monday) return [];
  const trained = new Set(trainedDates);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of anchors) {
    const d = getDateForWeekDay(a.week, a.day as DayOfWeek);
    if (d >= monday && d < todayISO && !trained.has(d) && !seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out.sort();
}

/** Full days between the last trained date and today (UTC-day arithmetic). */
export function daysSince(lastTrainedAt: string, todayISO: string): number {
  const day = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  };
  return Math.max(0, Math.round(day(todayISO) - day(lastTrainedAt)));
}

export function triageFlags(input: {
  anchors: PlanAnchor[];
  trainedDates: string[];
  lastTrainedAt: string | null;
  todayISO: string;
}): TriageFlags {
  const missed = missedPlannedDates(input.anchors, input.trainedDates, input.todayISO);
  const noSessions = input.lastTrainedAt === null;
  const gap = input.lastTrainedAt ? daysSince(input.lastTrainedAt, input.todayISO) : null;
  const quietDays = gap !== null && gap >= QUIET_DAYS ? gap : null;
  const score =
    missed.length * 2 +
    (quietDays !== null ? 2 : 0) +
    (noSessions ? 1 : 0);
  return { missed, quietDays, noSessions, score };
}

/** Stable triage order: flagged first by score desc; ties → staler training
 *  first (never-trained counts as stalest); zero-score rows keep input order. */
export function triageOrder<T>(
  rows: T[],
  flagsOf: (row: T) => TriageFlags,
  lastTrainedOf: (row: T) => string | null
): T[] {
  return rows
    .map((row, i) => ({ row, i, f: flagsOf(row) }))
    .sort((a, b) => {
      if (a.f.score !== b.f.score) return b.f.score - a.f.score;
      if (a.f.score === 0) return a.i - b.i;
      const la = lastTrainedOf(a.row); const lb = lastTrainedOf(b.row);
      if (la === lb) return a.i - b.i;
      if (la === null) return -1;
      if (lb === null) return 1;
      return la < lb ? -1 : 1;
    })
    .map((x) => x.row);
}
