/**
 * plan-diff.ts — pure helpers for coach-UX Track 2 (plan vs actual).
 *
 * Compares a coach-prescribed day (coach_assignments exercises) against the
 * trainee's actual log (blob day exercises) and reports, per exercise and per
 * set, what was done as prescribed, what deviated, what was skipped and what
 * the trainee added unplanned.
 *
 * No Supabase, no store access — unit-testable in isolation.
 *
 * Matching: id-first (materialization preserves exercise ids — see
 * seedMaterializedExercises), then normalized-name fallback (trainee may have
 * built the day manually instead of materializing). Anything left unmatched is
 * reported honestly as skipped/unplanned, never force-paired.
 *
 * v1 trade-off (documented, mirrors triage.ts style): the diff is always
 * against the CURRENT plan version. If the coach edits the plan after the
 * trainee started the day, the panel shows the edited plan — there is no
 * per-day plan snapshot to compare against.
 */
import type { Exercise } from '../types/workout';
import { normalizeExerciseName } from '../data/exercises';

export type SetDiffStatus = 'as-prescribed' | 'changed' | 'missing' | 'extra';

export interface SetDiff {
  /** 1-based display index (position in the longer of the two set lists). */
  index: number;
  prescribed: { kg: string; reps: string } | null;
  actual: { kg: string; reps: string; done: boolean; rpe: string } | null;
  status: SetDiffStatus;
}

export type ExerciseDiffStatus = 'matched' | 'skipped' | 'unplanned';

export interface ExerciseDiff {
  /** Stable unique render key: 'p<planIdx>' for plan-side rows, 'a<actualIdx>'
   *  for unplanned rows. Names/codes may legitimately repeat within a day. */
  key: string;
  /** Plan-side name for matched/skipped; actual-side name for unplanned. */
  name: string;
  code: string;
  status: ExerciseDiffStatus;
  matchedBy: 'id' | 'name' | null;
  /** True for recovery/conditioning entries — compared by done flag, not sets. */
  flagOnly: boolean;
  /** For flagOnly matched exercises: did the trainee complete it? */
  flagDone: boolean;
  sets: SetDiff[];
  /** Count of non-as-prescribed set rows (changed + missing + extra). */
  deviations: number;
  /** Prescribed set count (plan side). 0 for flagOnly/unplanned. */
  setsPlanned: number;
  /** Done sets among PRESCRIBED rows for matched exercises (badge numerator
   *  shares setsPlanned's denominator — extra rows never count); plain done
   *  count for unplanned rows (informational). */
  setsDoneCount: number;
  /** Honest completion: flagOnly ? done flag : every prescribed set done.
   *  Pairing alone is NOT completion — an untouched materialized day is
   *  matched but complete=false (adversarial F1). */
  complete: boolean;
}

export interface PlanDiffSummary {
  planned: number;
  matched: number;
  /** Matched exercises the trainee actually completed (see ExerciseDiff.complete). */
  exercisesDone: number;
  skipped: number;
  unplanned: number;
  setsAsPrescribed: number;
  setsChanged: number;
  setsMissing: number;
  setsExtra: number;
  setsDone: number;
}

export interface PlanDiff {
  /** Plan order first (matched + skipped interleaved as planned), then unplanned in actual order. */
  exercises: ExerciseDiff[];
  summary: PlanDiffSummary;
}

/** '60' == '60.0' == ' 60 ' numerically; otherwise trimmed string equality. */
export function sameValue(a: string, b: string): boolean {
  const ta = (a ?? '').trim();
  const tb = (b ?? '').trim();
  if (ta === tb) return true;
  if (ta === '' || tb === '') return false;
  const na = Number(ta);
  const nb = Number(tb);
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
}

function isFlagOnly(ex: Exercise): boolean {
  return !!ex.recovery || !!ex.conditioning;
}

function flagDone(ex: Exercise): boolean {
  return !!(ex.recovery ? ex.recoveryDone : ex.conditioningDone);
}

function diffSets(planned: Exercise, actual: Exercise): SetDiff[] {
  const out: SetDiff[] = [];
  const n = Math.max(planned.sets.length, actual.sets.length);
  for (let i = 0; i < n; i++) {
    const p = planned.sets[i];
    const a = actual.sets[i];
    let status: SetDiffStatus;
    if (p && a) {
      status = sameValue(p.kg, a.kg) && sameValue(p.reps, a.reps) ? 'as-prescribed' : 'changed';
    } else {
      status = p ? 'missing' : 'extra';
    }
    out.push({
      index: i + 1,
      prescribed: p ? { kg: p.kg, reps: p.reps } : null,
      actual: a ? { kg: a.kg, reps: a.reps, done: a.done, rpe: a.rpe } : null,
      status,
    });
  }
  return out;
}

/**
 * Diff a prescribed plan against the actual log.
 * Returns null when there is no plan to compare against (empty/absent) —
 * callers use null as "do not render the panel".
 */
export function diffPlanVsActual(
  planned: readonly Exercise[] | undefined | null,
  actual: readonly Exercise[] | undefined | null
): PlanDiff | null {
  if (!planned || planned.length === 0) return null;
  const act = actual ?? [];

  // Pass 1: id match. Pass 2: normalized-name match among leftovers, consumed
  // in order so duplicate names pair positionally instead of double-matching.
  const usedActual = new Set<number>();
  const pairing = new Map<number, { actualIdx: number; by: 'id' | 'name' }>();

  planned.forEach((p, pi) => {
    const ai = act.findIndex((a, i) => !usedActual.has(i) && a.id === p.id);
    if (ai >= 0) {
      usedActual.add(ai);
      pairing.set(pi, { actualIdx: ai, by: 'id' });
    }
  });
  planned.forEach((p, pi) => {
    if (pairing.has(pi)) return;
    const pname = normalizeExerciseName(p.name);
    const ai = act.findIndex(
      (a, i) => !usedActual.has(i) && normalizeExerciseName(a.name) === pname
    );
    if (ai >= 0) {
      usedActual.add(ai);
      pairing.set(pi, { actualIdx: ai, by: 'name' });
    }
  });

  const exercises: ExerciseDiff[] = [];
  const summary: PlanDiffSummary = {
    planned: planned.length,
    matched: 0,
    exercisesDone: 0,
    skipped: 0,
    unplanned: 0,
    setsAsPrescribed: 0,
    setsChanged: 0,
    setsMissing: 0,
    setsExtra: 0,
    setsDone: 0,
  };

  planned.forEach((p, pi) => {
    const pair = pairing.get(pi);
    if (!pair) {
      summary.skipped++;
      exercises.push({
        key: `p${pi}`, name: p.name, code: p.code, status: 'skipped', matchedBy: null,
        flagOnly: isFlagOnly(p), flagDone: false, sets: [], deviations: 0,
        setsPlanned: isFlagOnly(p) ? 0 : p.sets.length, setsDoneCount: 0, complete: false,
      });
      return;
    }
    const a = act[pair.actualIdx];
    summary.matched++;
    // The PLAN side decides the comparison kind (adversarial F2): a flag-only
    // prescription stays a done/not-done row even if the trainee logged sets
    // (any done set counts as done); a set prescription always shows its
    // prescribed sets, even against a flag-only actual (rows read missing).
    if (isFlagOnly(p)) {
      const done = isFlagOnly(a) ? flagDone(a) : a.sets.some((x) => x.done);
      if (done) summary.exercisesDone++;
      exercises.push({
        key: `p${pi}`, name: p.name, code: p.code, status: 'matched', matchedBy: pair.by,
        flagOnly: true, flagDone: done, sets: [], deviations: 0,
        setsPlanned: 0, setsDoneCount: 0, complete: done,
      });
      return;
    }
    const sets = diffSets(p, a);
    let deviations = 0;
    let setsPlanned = 0;
    let setsDoneCount = 0;
    let prescribedAllDone = true;
    for (const s of sets) {
      if (s.status === 'as-prescribed') summary.setsAsPrescribed++;
      else {
        deviations++;
        if (s.status === 'changed') summary.setsChanged++;
        else if (s.status === 'missing') summary.setsMissing++;
        else summary.setsExtra++;
      }
      if (s.prescribed) {
        setsPlanned++;
        if (s.actual?.done) setsDoneCount++;
        else prescribedAllDone = false;
      }
      if (s.actual?.done) summary.setsDone++;
    }
    const complete = setsPlanned > 0 && prescribedAllDone;
    if (complete) summary.exercisesDone++;
    exercises.push({
      key: `p${pi}`, name: p.name, code: p.code, status: 'matched', matchedBy: pair.by,
      flagOnly: false, flagDone: false, sets, deviations,
      setsPlanned, setsDoneCount, complete,
    });
  });

  act.forEach((a, i) => {
    if (usedActual.has(i)) return;
    summary.unplanned++;
    const sets: SetDiff[] = isFlagOnly(a) ? [] : a.sets.map((s, si) => ({
      index: si + 1,
      prescribed: null,
      actual: { kg: s.kg, reps: s.reps, done: s.done, rpe: s.rpe },
      status: 'extra' as const,
    }));
    for (const s of sets) {
      summary.setsExtra++;
      if (s.actual?.done) summary.setsDone++;
    }
    exercises.push({
      key: `a${i}`, name: a.name, code: a.code, status: 'unplanned', matchedBy: null,
      flagOnly: isFlagOnly(a), flagDone: flagDone(a), sets, deviations: sets.length,
      setsPlanned: 0, setsDoneCount: sets.filter((s) => s.actual?.done).length, complete: false,
    });
  });

  return { exercises, summary };
}
