/**
 * triage.test.ts — coach dashboard triage derivation (lib/triage.ts).
 * Dates ride on the real program calendar: PROGRAM_START Monday 2026-02-16,
 * so week 21 Monday = 2026-07-06 (todayISO 2026-07-08 = week 21 Wednesday).
 */
import { describe, it, expect } from 'vitest';
import {
  missedPlannedDates, daysSince, triageFlags, triageOrder, programWeekMonday, QUIET_DAYS,
} from '../lib/triage';
import { getDateForWeekDay, getWeekDayForDate } from '../lib/dates';

const TODAY = '2026-07-08'; // Wednesday of program week 21
const W = getWeekDayForDate(TODAY)!.week;

describe('programWeekMonday', () => {
  it('returns the Monday of the program week containing today', () => {
    expect(programWeekMonday(TODAY)).toBe(getDateForWeekDay(W, 'Monday'));
  });
  it('returns null before PROGRAM_START', () => {
    expect(programWeekMonday('2026-01-05')).toBeNull();
  });
});

describe('missedPlannedDates', () => {
  it('flags a planned past day this week with no trained date (materialized-but-untouched included)', () => {
    const monday = getDateForWeekDay(W, 'Monday');
    expect(missedPlannedDates([{ week: W, day: 'Monday' }], [], TODAY)).toEqual([monday]);
  });

  it('never flags today or future days', () => {
    expect(missedPlannedDates(
      [{ week: W, day: 'Wednesday' }, { week: W, day: 'Friday' }], [], TODAY
    )).toEqual([]);
  });

  it('does not flag a planned day the trainee trained', () => {
    const monday = getDateForWeekDay(W, 'Monday');
    expect(missedPlannedDates([{ week: W, day: 'Monday' }], [monday], TODAY)).toEqual([]);
  });

  it('ignores plans from previous weeks (week boundary)', () => {
    expect(missedPlannedDates([{ week: W - 1, day: 'Friday' }], [], TODAY)).toEqual([]);
  });

  it('dedupes anchors landing on the same date and sorts', () => {
    const mon = getDateForWeekDay(W, 'Monday');
    const tue = getDateForWeekDay(W, 'Tuesday');
    expect(missedPlannedDates(
      [{ week: W, day: 'Tuesday' }, { week: W, day: 'Monday' }, { week: W, day: 'Monday' }],
      [], TODAY
    )).toEqual([mon, tue]);
  });

  it('is empty with no plan at all', () => {
    expect(missedPlannedDates([], [], TODAY)).toEqual([]);
  });
});

describe('daysSince / quiet', () => {
  it('counts full days between last trained and today', () => {
    expect(daysSince('2026-07-06', TODAY)).toBe(2);
    expect(daysSince(TODAY, TODAY)).toBe(0);
  });
  it('accepts timestamps (slices the date part)', () => {
    expect(daysSince('2026-07-04 10:15:00+00', TODAY)).toBe(4);
  });
  it('quietDays kicks in at exactly QUIET_DAYS', () => {
    const at = (gapDays: number) =>
      triageFlags({ anchors: [], trainedDates: [], todayISO: TODAY,
        lastTrainedAt: `2026-07-${String(8 - gapDays).padStart(2, '0')}` });
    expect(at(QUIET_DAYS - 1).quietDays).toBeNull();
    expect(at(QUIET_DAYS).quietDays).toBe(QUIET_DAYS);
  });
});

describe('triageFlags scoring', () => {
  it('all-good trainee scores 0', () => {
    const f = triageFlags({ anchors: [], trainedDates: [], lastTrainedAt: '2026-07-07', todayISO: TODAY });
    expect(f.score).toBe(0);
    expect(f.missed).toEqual([]);
    expect(f.quietDays).toBeNull();
    expect(f.noSessions).toBe(false);
  });

  it('never-trained trainee is flagged noSessions (weight 1)', () => {
    const f = triageFlags({ anchors: [], trainedDates: [], lastTrainedAt: null, todayISO: TODAY });
    expect(f.noSessions).toBe(true);
    expect(f.score).toBe(1);
  });

  it('missed days weigh heaviest; unread never contributes to the score', () => {
    const f = triageFlags({
      anchors: [{ week: W, day: 'Monday' }, { week: W, day: 'Tuesday' }],
      trainedDates: [], lastTrainedAt: '2026-07-01', todayISO: TODAY,
    });
    // 2 missed (4) + quiet 7d (2) — noSessions false; no unread term exists
    expect(f.missed).toHaveLength(2);
    expect(f.quietDays).toBe(7);
    expect(f.score).toBe(6);
  });

  it('unread never contributes to the score, even if reintroduced as an input', () => {
    // Mutation pin: smuggle an unread field past the type system — if a future
    // change re-adds an unread term to the score, this scores 1 and fails.
    const f = triageFlags({ anchors: [], trainedDates: [], lastTrainedAt: '2026-07-07',
      todayISO: TODAY, ...({ unread: 99 } as object) } as Parameters<typeof triageFlags>[0]);
    expect(f.score).toBe(0);
    expect('unread' in f).toBe(false);
  });
});

describe('triageOrder', () => {
  interface Row { id: string; last: string | null; f: ReturnType<typeof triageFlags>; }
  const mk = (id: string, last: string | null, anchors: { week: number; day: string }[] = []): Row =>
    ({ id, last, f: triageFlags({ anchors, trainedDates: [], lastTrainedAt: last, todayISO: TODAY }) });
  const order = (rows: Row[]) =>
    triageOrder(rows, (r) => r.f, (r) => r.last).map((r) => r.id);

  it('flagged first by score desc; zero-score rows keep input order', () => {
    const a = mk('a', '2026-07-07');                               // score 0
    const b = mk('b', '2026-07-01', [{ week: W, day: 'Monday' }]); // missed 2 + quiet 2 = 4
    const c = mk('c', '2026-07-07');                               // score 0
    const d = mk('d', '2026-07-08');                               // score 0
    expect(order([a, b, c, d])).toEqual(['b', 'a', 'c', 'd']);
  });

  it('higher score always first', () => {
    const x = mk('x', '2026-07-01', [{ week: W, day: 'Monday' }]); // 4
    const z = mk('z', null, [{ week: W, day: 'Monday' }, { week: W, day: 'Tuesday' }]); // missed 4 + noSessions 1 = 5
    expect(order([x, z])).toEqual(['z', 'x']);
  });

  it('same score → staler training first', () => {
    const p = mk('p', '2026-07-01', [{ week: W, day: 'Monday' }]); // 4
    const r = mk('r', '2026-06-28', [{ week: W, day: 'Monday' }]); // 4, staler
    expect(order([p, r])).toEqual(['r', 'p']);
  });

  it('two never-trained rows (equal score) keep input order', () => {
    // Note: with weights missed*2/quiet*2/noSessions*1, trained rows score even
    // and never-trained rows score odd — a trained/never-trained tie can't
    // occur, so the null-stalest branch is defensive. Equal-null pairs fall
    // through to input order.
    const u = mk('u', null);
    const v = mk('v', null);
    expect(order([u, v])).toEqual(['u', 'v']);
  });
});
