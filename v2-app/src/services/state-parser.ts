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

const KNOWN_SCHEMAS = new Set<string>(['4.0', '4.1']);

/** Parse and normalise stored state. Returns null for non-object input. */
export function parseAndMigrateState(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;

  const state = raw as AppState;

  // Future-schema guard: if a newer client wrote this blob we can still parse
  // it (spread preserves unknown fields) but we log so it's detectable.
  if (state.schema && !KNOWN_SCHEMAS.has(state.schema as string)) {
    console.warn(
      `[state-parser] Unknown schema version "${state.schema}" — proceeding with best-effort parse. Update the app if issues occur.`
    );
  }

  if (Array.isArray(state.weeks)) {
    // Backfill fields added after the initial schema — existing value wins via ??.
    // Everything else (kg, reps, done, superset codes, order, notes) is preserved.
    // Null-element guards: null/undefined entries in weeks[], exercises[], or sets[]
    // can appear from historical blob corruption — filter them out so
    // parseAndMigrateState never throws on a valid 200 response from Supabase.
    return {
      ...state,
      schema: '4.1',
      weeks: state.weeks
        .filter(wd => wd != null)
        .map(wd => ({
          ...wd,
          exercises: (wd.exercises ?? [])
            .filter(ex => ex != null)
            .map(ex => ({
              ...ex,
              conditioning: ex.conditioning ?? false,
              conditioningNote: ex.conditioningNote ?? '',
              conditioningDone: ex.conditioningDone ?? false,
              sets: (ex.sets ?? [])
                .filter(s => s != null)
                .map(s => ({ ...s, rpe: s.rpe ?? '' })),
            })),
        })),
    };
  }

  return emptyAppState();
}
