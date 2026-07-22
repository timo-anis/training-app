/**
 * workout-summary.ts — pure, side-effect-free session-summary derivations.
 *
 * Extracted verbatim from WorkoutMode.svelte (deep-analysis P1-1 step 2,
 * audit-first order per WORKFLOW §2: read-only helper extraction only — no
 * runtime orchestration, no store/DOM/$state access). These were inline
 * `$derived` IIFEs and a `isPR` function inside a 1600-line component with zero
 * tests; being pure `(weeks, week, day) -> X` functions they are unit-tested
 * here and imported back. Behavior is byte-identical to the in-component
 * originals — in particular PR detection reads DONE sets only and matches
 * exercises through normalizeExerciseName (see [[project_data_integrity]]).
 */
import type { WorkoutDay, DayOfWeek } from '../types/workout';
import { DAY_ORDER } from '../types/workout';
import { normalizeExerciseName } from '../data/exercises';
import { dayVolume, fmtVolume } from './workout-metrics';

/**
 * True if `currentKg` beats every prior DONE-set weight logged for the same
 * (canonical) exercise, excluding the current (week, day). Name variants are
 * folded through normalizeExerciseName so they map to one exercise.
 */
export function isPersonalRecord(
  weeks: WorkoutDay[],
  curWeek: number,
  curDay: DayOfWeek,
  exName: string,
  currentKg: string,
): boolean {
  const kg = parseFloat(currentKg.replace(',', '.'));
  if (isNaN(kg) || kg <= 0) return false;
  const canonical = normalizeExerciseName(exName);
  let max = 0;
  for (const wd of weeks) {
    if (wd.week === curWeek && wd.day === curDay) continue;
    for (const ex of wd.exercises) {
      if (normalizeExerciseName(ex.name) !== canonical) continue;
      for (const s of ex.sets) {
        if (!s.done) continue; // only real logged sets count
        const v = parseFloat(s.kg);
        if (!isNaN(v) && v > max) max = v;
      }
    }
  }
  return max > 0 && kg > max;
}

/**
 * Consecutive weeks with logged activity, counting back from and including
 * `curWeek`. The current session always counts (even before `completed` is
 * set). The activity predicate mirrors dayHasActivity (stores/workout-state.ts)
 * — any done set, conditioning-done, or recovery-done marks a week active —
 * kept inline here to keep this module a pure leaf (no store import).
 */
export function sessionStreak(weeks: WorkoutDay[], curWeek: number): number {
  const active = new Set<number>();
  for (const wd of weeks) {
    const hasActivity = wd.exercises.some(
      ex => ex.sets.some(s => s.done) || ex.conditioningDone || ex.recoveryDone,
    );
    if (hasActivity) active.add(wd.week);
  }
  active.add(curWeek); // current session counts even before "completed" is set
  let streak = 0;
  let w = curWeek;
  while (active.has(w)) { streak++; w--; }
  return streak;
}

/**
 * Volume of the most recent prior strength session (the latest (week, day)
 * strictly before the current one that has non-zero volume). Returns null when
 * there is no current-day entry or no qualifying prior session.
 */
export function prevSessionVolume(
  weeks: WorkoutDay[],
  curWeek: number,
  curDay: DayOfWeek,
): number | null {
  const summaryDay = weeks.find(w => w.week === curWeek && w.day === curDay);
  if (!summaryDay) return null;
  const curIdx = DAY_ORDER.indexOf(curDay);
  let best: { week: number; dayIdx: number; vol: number } | null = null;
  for (const wd of weeks) {
    if (wd.week === curWeek && wd.day === curDay) continue;
    const dIdx = DAY_ORDER.indexOf(wd.day);
    const isBefore = wd.week < curWeek || (wd.week === curWeek && dIdx < curIdx);
    if (!isBefore) continue;
    const vol = dayVolume(wd);
    if (vol <= 0) continue;
    const better = !best || wd.week > best.week || (wd.week === best.week && dIdx > best.dayIdx);
    if (better) best = { week: wd.week, dayIdx: dIdx, vol };
  }
  return best ? best.vol : null;
}

/**
 * Percentage + labelled delta between this session's volume and the previous
 * session's. Returns null when there is no prior volume or the rounded absolute
 * delta is zero.
 */
export function volumeDelta(
  curVolume: number,
  prevVolume: number | null,
): { pct: number; dir: 'up' | 'down'; label: string } | null {
  if (prevVolume === null || prevVolume <= 0) return null;
  const abs = curVolume - prevVolume;
  if (Math.round(abs) === 0) return null;
  const pct = Math.round((abs / prevVolume) * 100);
  const sign = abs >= 0 ? '+' : '-';
  const dir: 'up' | 'down' = abs >= 0 ? 'up' : 'down';
  return { pct, dir, label: `${sign}${fmtVolume(Math.abs(abs))}` };
}

/**
 * Heaviest DONE set of a day as a display string ("Name kg × reps"), preferring
 * higher kg then higher reps. Ignores recovery/conditioning blocks. Returns null
 * for no day or no qualifying set.
 */
export function bestSet(day: WorkoutDay | undefined): string | null {
  if (!day) return null;
  let best: { name: string; kg: number; reps: string } | null = null;
  for (const ex of day.exercises) {
    if (ex.recovery || ex.conditioning) continue;
    for (const s of ex.sets) {
      if (!s.done) continue;
      const kg = parseFloat(s.kg);
      if (isNaN(kg) || kg <= 0) continue;
      const reps = parseInt(s.reps) || 0;
      const bestReps = best ? (parseInt(best.reps) || 0) : -1;
      if (!best || kg > best.kg || (kg === best.kg && reps > bestReps)) {
        best = { name: ex.name, kg, reps: s.reps };
      }
    }
  }
  return best ? `${best.name} ${best.kg} × ${best.reps}` : null;
}

/**
 * PRs hit in the current session: each strength exercise whose top DONE kg beats
 * its prior all-time max (from DONE sets of other days, matched by canonical
 * name). Returns [] when there is no current-day entry.
 */
export function sessionPRs(
  weeks: WorkoutDay[],
  curWeek: number,
  curDay: DayOfWeek,
): { name: string; oldKg: number; newKg: number }[] {
  const summaryDay = weeks.find(w => w.week === curWeek && w.day === curDay);
  if (!summaryDay) return [];
  const out: { name: string; oldKg: number; newKg: number }[] = [];
  for (const ex of summaryDay.exercises) {
    if (ex.recovery || ex.conditioning) continue;
    let newKg = 0;
    for (const s of ex.sets) {
      if (!s.done) continue;
      const v = parseFloat(s.kg);
      if (!isNaN(v) && v > newKg) newKg = v;
    }
    if (newKg <= 0) continue;
    const exCanonical = normalizeExerciseName(ex.name);
    let prevMax = 0;
    for (const wd of weeks) {
      if (wd.week === curWeek && wd.day === curDay) continue;
      for (const e of wd.exercises) {
        if (normalizeExerciseName(e.name) !== exCanonical) continue;
        for (const s of e.sets) {
          if (!s.done) continue; // only real logged sets count
          const v = parseFloat(s.kg);
          if (!isNaN(v) && v > prevMax) prevMax = v;
        }
      }
    }
    if (prevMax > 0 && newKg > prevMax) out.push({ name: ex.name, oldKg: prevMax, newKg });
  }
  return out;
}

/**
 * Soonest planned session strictly after the current (week, day) that has at
 * least one non-recovery exercise. Returns null when none exists.
 */
export function nextPlannedSession(
  weeks: WorkoutDay[],
  curWeek: number,
  curDay: DayOfWeek,
): { day: DayOfWeek; count: number; nextWeek: boolean } | null {
  const curIdx = DAY_ORDER.indexOf(curDay);
  let best: { week: number; dayIdx: number; day: DayOfWeek; count: number } | null = null;
  for (const wd of weeks) {
    const dIdx = DAY_ORDER.indexOf(wd.day);
    const isAfter = wd.week > curWeek || (wd.week === curWeek && dIdx > curIdx);
    if (!isAfter) continue;
    const count = wd.exercises.filter(e => !e.recovery).length;
    if (count === 0) continue;
    const earlier = !best || wd.week < best.week || (wd.week === best.week && dIdx < best.dayIdx);
    if (earlier) best = { week: wd.week, dayIdx: dIdx, day: wd.day, count };
  }
  if (!best) return null;
  return { day: best.day, count: best.count, nextWeek: best.week > curWeek };
}
