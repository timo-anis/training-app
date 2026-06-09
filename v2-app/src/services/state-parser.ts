/**
 * State parser / normaliser.
 *
 * Loads stored V2 workout state (structured `weeks[]`, schema 4.0) and backfills
 * any fields that were added after the initial schema, so older saved blobs stay
 * valid. Runs on every local/cloud load.
 */

import type { AppState } from '../types/workout';
import { emptyAppState } from '../types/workout';

/** Parse and normalise stored state. Returns null for non-object input. */
export function parseAndMigrateState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;

  const state = raw as AppState;
  if (Array.isArray(state.weeks)) {
    // Backfill fields added after the initial schema — existing value wins via ??
    return {
      ...state,
      weeks: state.weeks.map(wd => ({
        ...wd,
        exercises: wd.exercises.map(ex => ({
          ...ex,
          conditioning: ex.conditioning ?? false,
          conditioningNote: ex.conditioningNote ?? '',
          conditioningDone: ex.conditioningDone ?? false,
        })),
      })),
    };
  }

  return emptyAppState();
}
