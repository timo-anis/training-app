/**
 * RPE-based muscle recovery calculator.
 * Recovery window: RPE 9–10 → 72h, RPE 7–8 → 48h, RPE ≤6 → 36h, no RPE → 48h.
 */

import type { WorkoutDay } from '../types/workout';
import { getMusclesForExercise, MUSCLE_ORDER, MUSCLE_LABELS, type MuscleGroup } from './muscle-map';

export interface MuscleRecovery {
  muscle: MuscleGroup;
  label: string;
  lastDate: string | null;       // ISO date of last training
  hoursAgo: number | null;
  lastRpe: number | null;        // max RPE of last session (null = not rated)
  recoveryHours: number;         // total window
  pct: number;                   // 0–1  (1 = fully recovered)
  ready: boolean;
  hoursLeft: number;             // hours remaining (0 if ready)
}

function rpeWindow(rpe: number | null): number {
  if (rpe === null) return 48;
  if (rpe >= 9)     return 72;
  if (rpe >= 7)     return 48;
  return 36;
}

export function computeRecovery(weeks: WorkoutDay[]): MuscleRecovery[] {
  // Find most recent training date + max RPE per muscle group.
  const latest = new Map<MuscleGroup, { date: string; rpe: number | null }>();

  // Sort newest first so first hit = most recent
  const sorted = [...weeks].sort((a, b) => b.date.localeCompare(a.date));

  for (const wd of sorted) {
    for (const ex of wd.exercises) {
      if (ex.recovery || ex.conditioning) continue;
      const muscles = getMusclesForExercise(ex.name);
      if (muscles.length === 0) continue;

      const rpeVals = ex.sets
        .filter(s => s.done && s.rpe !== '')
        .map(s => parseFloat(s.rpe))
        .filter(r => !isNaN(r));
      const maxRpe = rpeVals.length > 0 ? Math.max(...rpeVals) : null;

      for (const mg of muscles) {
        const cur = latest.get(mg);
        if (!cur) {
          latest.set(mg, { date: wd.date, rpe: maxRpe });
        } else if (cur.date === wd.date && maxRpe !== null && (cur.rpe === null || maxRpe > cur.rpe)) {
          // Same day — keep highest RPE
          latest.set(mg, { date: wd.date, rpe: maxRpe });
        }
        // Older date — already have a more recent one, skip
      }
    }
  }

  const now = Date.now();

  return MUSCLE_ORDER.map(mg => {
    const info = latest.get(mg) ?? null;

    if (!info) {
      return {
        muscle: mg, label: MUSCLE_LABELS[mg],
        lastDate: null, hoursAgo: null, lastRpe: null,
        recoveryHours: 48, pct: 1, ready: true, hoursLeft: 0,
      };
    }

    // Parse ISO date as UTC midnight (dates stored as UTC in app)
    const [y, m, d] = info.date.split('-').map(Number);
    const trainedMs = Date.UTC(y, m - 1, d);
    const hoursAgo = Math.max(0, (now - trainedMs) / 3_600_000);
    const recoveryHours = rpeWindow(info.rpe);
    const pct = Math.min(1, hoursAgo / recoveryHours);
    const hoursLeft = Math.max(0, Math.ceil(recoveryHours - hoursAgo));

    return {
      muscle: mg, label: MUSCLE_LABELS[mg],
      lastDate: info.date,
      hoursAgo: Math.round(hoursAgo),
      lastRpe: info.rpe,
      recoveryHours, pct,
      ready: pct >= 1,
      hoursLeft,
    };
  });
}

/** Color for ring stroke based on recovery pct */
export function ringColor(pct: number): string {
  if (pct >= 0.9) return '#4fc08d';
  if (pct >= 0.5) return '#f59e0b';
  return '#ef4444';
}

/** Track (background ring) color */
export function trackColor(pct: number): string {
  if (pct >= 0.9) return 'rgba(79,192,141,0.12)';
  if (pct >= 0.5) return 'rgba(245,158,11,0.12)';
  return 'rgba(239,68,68,0.12)';
}
