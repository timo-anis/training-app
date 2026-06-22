/**
 * State parser / normaliser.
 *
 * Loads stored V2 workout state (structured `weeks[]`) and backfills any fields
 * that were added after the initial schema, so older saved blobs stay valid.
 * Runs on every local/cloud load.
 *
 * Schema history:
 *   4.0 — base structured state
 *   4.1 — per-set `rpe` (RIR-based RPE 6–10; '' = not rated)
 */

import type { AppState } from '../types/workout';
import { emptyAppState } from '../types/workout';

/** Parse and normalise stored state. Returns null for non-object input. */
export function parseAndMigrateState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;

  const state = raw as AppState;
  if (Array.isArray(state.weeks)) {
    // Backfill fields added after the initial schema — existing value wins via ??.
    // Everything else (kg, reps, done, superset codes, order, notes) is preserved.
    return {
      ...state,
      schema: '4.1',
      weeks: state.weeks.map(wd => ({
        ...wd,
        exercises: wd.exercises.map(ex => ({
          ...ex,
          conditioning: ex.conditioning ?? false,
          conditioningNote: ex.conditioningNote ?? '',
          conditioningDone: ex.conditioningDone ?? false,
          sets: ex.sets.map(s => ({ ...s, rpe: s.rpe ?? '' })),
        })),
      })),
    };
  }

  return emptyAppState();
}
