/**
 * MVP1 → V2 State Migrator
 *
 * MVP1 stores workout data as a flat key-value object:
 *   "exname_w1_mon_bench_press" → "Bench Press"
 *   "sc_w1_mon_bench_press"     → 3  (set count)
 *   "w1_mon_bench_press_s0"     → { kg: "80", reps: "8", done: "1" }
 *   "excode_w1_mon_bench_press" → "A"  (superset code)
 *   "rest_w1_mon_bench_press"   → "2:00"
 *   "note_w1_mon_bench_press"   → ""
 *   "blockdone_w1_mon_bench_press" → "1"  (recovery block done)
 *
 * V2 uses a structured WorkoutDay[] array.
 * This file converts MVP1 → V2 format on first load.
 */

import type { AppState, WorkoutDay, Exercise, WorkoutSet, DayOfWeek } from '../types/workout';
import { emptyAppState } from '../types/workout';
import { PS_UTC } from '../lib/program';

const MVP1_DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type MVP1Day = typeof MVP1_DAY_ORDER[number];

const DAY_MAP: Record<MVP1Day, DayOfWeek> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function dayDate(week: number, mvp1Day: MVP1Day): string {
  const dayIndex = MVP1_DAY_ORDER.indexOf(mvp1Day);
  const utc = PS_UTC + ((week - 1) * 7 + dayIndex) * 86400000;
  const d = new Date(utc);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ---- Detect MVP1 format ----

type RawObject = Record<string, unknown>;

export function isMvp1State(raw: unknown): raw is RawObject {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as RawObject;
  // MVP1 has __meta, V2 has weeks[]
  return '__meta' in obj && !('weeks' in obj);
}

// ---- Extract exercises for a week/day from flat MVP1 state ----

function extractExerciseIds(state: RawObject, week: number, day: MVP1Day): string[] {
  const seen = new Set<string>();
  const metaPattern = new RegExp(
    `^(sc|note|interval|rest|exname|exlabel|exss|excode|hidden|blockdone)_w${week}_${day}_(.+)$`
  );
  const setPattern = new RegExp(`^w${week}_${day}_(.+)_s\\d+$`);

  for (const key of Object.keys(state)) {
    const m1 = key.match(metaPattern);
    if (m1) { seen.add(m1[2]); continue; }
    const m2 = key.match(setPattern);
    if (m2) seen.add(m2[1]);
  }

  // Filter out hidden exercises
  return Array.from(seen).filter(
    ex => !state[`hidden_w${week}_${day}_${ex}`]
  );
}

function extractSets(state: RawObject, week: number, day: MVP1Day, ex: string): WorkoutSet[] {
  const count = Number(state[`sc_w${week}_${day}_${ex}`] ?? 1);
  const sets: WorkoutSet[] = [];
  for (let i = 0; i < Math.max(1, count); i++) {
    const raw = state[`w${week}_${day}_${ex}_s${i}`] as Record<string, string> | undefined;
    sets.push({
      kg: raw?.kg ?? '',
      reps: raw?.reps ?? '',
      done: String(raw?.done ?? '') === '1',
    });
  }
  return sets;
}

function extractExercise(state: RawObject, week: number, day: MVP1Day, exId: string): Exercise {
  const name =
    String(state[`exname_w${week}_${day}_${exId}`] ?? exId.replace(/_/g, ' '));
  const rawCode = String(
    state[`excode_w${week}_${day}_${exId}`] ??
    state[`exss_w${week}_${day}_${exId}`] ??
    state[`exlabel_w${week}_${day}_${exId}`] ??
    ''
  ).toUpperCase().trim();

  const isSuperset = /^[A-Z]\d*$/.test(rawCode);
  const recovery = /^(foam|stretch|mobility|recovery|warmup|cool)/i.test(name);
  const recoveryDone = String(state[`blockdone_w${week}_${day}_${exId}`] ?? '') === '1';

  return {
    id: exId,
    name,
    type: isSuperset ? 'superset' : 'single',
    code: rawCode,
    sets: recovery ? [] : extractSets(state, week, day, exId),
    rest: String(state[`rest_w${week}_${day}_${exId}`] ?? state[`interval_w${week}_${day}_${exId}`] ?? ''),
    note: String(state[`note_w${week}_${day}_${exId}`] ?? ''),
    recovery,
    recoveryDone,
    conditioning: false,
    conditioningNote: '',
    conditioningDone: false,
  };
}

// ---- Sort exercises (supersets grouped, singles last) ----
function sortExercises(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) => {
    const aCode = a.code.match(/^([A-Z])(\d+)?$/);
    const bCode = b.code.match(/^([A-Z])(\d+)?$/);
    if (a.recovery !== b.recovery) return a.recovery ? 1 : -1;
    if (aCode && bCode) {
      if (aCode[1] !== bCode[1]) return aCode[1].localeCompare(bCode[1]);
      return Number(aCode[2] ?? 0) - Number(bCode[2] ?? 0);
    }
    if (aCode && !bCode) return -1;
    if (!aCode && bCode) return 1;
    return a.id.localeCompare(b.id);
  });
}

// ---- Extract all weeks from MVP1 state ----

function extractWeeks(state: RawObject): number[] {
  const weeks = new Set<number>();
  const m1Pattern = /^sc_w(\d+)_/;
  const m2Pattern = /^w(\d+)_/;
  for (const key of Object.keys(state)) {
    const m1 = key.match(m1Pattern);
    if (m1) { weeks.add(Number(m1[1])); continue; }
    const m2 = key.match(m2Pattern);
    if (m2) weeks.add(Number(m2[1]));
  }
  if (!weeks.size) weeks.add(1);
  return Array.from(weeks).sort((a, b) => a - b);
}

// ---- Main migration entry point ----

export function migrateMvp1ToV2(raw: RawObject): AppState {
  const weekNums = extractWeeks(raw);
  const workoutDays: WorkoutDay[] = [];

  for (const week of weekNums) {
    for (const mvp1Day of MVP1_DAY_ORDER) {
      const exIds = extractExerciseIds(raw, week, mvp1Day);
      if (!exIds.length) continue;

      const exercises = sortExercises(
        exIds.map(id => extractExercise(raw, week, mvp1Day, id))
      );

      workoutDays.push({
        week,
        day: DAY_MAP[mvp1Day],
        date: dayDate(week, mvp1Day),
        exercises,
      });
    }
  }

  return { weeks: workoutDays, schema: '4.0' };
}

// ---- Safe parse: handles both MVP1 and V2 format ----

export function parseAndMigrateState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;

  if (isMvp1State(raw)) {
    console.info('[V2] Detected MVP1 state — migrating to V2 format');
    return migrateMvp1ToV2(raw as RawObject);
  }

  const v2 = raw as AppState;
  if (Array.isArray(v2.weeks)) {
    // Normalise any exercises that predate the conditioningDone field
    const normalised: AppState = {
      ...v2,
      weeks: v2.weeks.map(wd => ({
        ...wd,
        exercises: wd.exercises.map(ex => ({
          conditioning: false,
          conditioningNote: '',
          conditioningDone: false,
          ...ex, // existing fields win — only fills in what's missing
        })),
      })),
    };
    return normalised;
  }

  return emptyAppState();
}
