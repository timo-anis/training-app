/**
 * workout-metrics.ts — pure, side-effect-free helpers for workout mode.
 *
 * Extracted verbatim from WorkoutMode.svelte (deep-analysis P1-1, audit-first
 * order per WORKFLOW §2: readonly helper extraction only — no runtime
 * orchestration, no store/DOM access). Being pure, they are unit-tested here
 * instead of hiding untested inside a 1600-line component. Behavior is
 * byte-identical to the in-component originals.
 */
import type { WorkoutDay } from '../types/workout';

// ---- Duration formatting / parsing ----

/** Elapsed seconds -> "M:SS" (or "H:MM:SS" past an hour). */
export function formatElapsed(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Parse a free-text rest string to seconds. Accepts "M:SS" (1:30 -> 90),
 * "<n>min"/"<n> min" (2min -> 120, 1.5min -> 90; a bare "m" is NOT minutes), or a bare number of seconds
 * (90 -> 90). Unparseable / empty -> 0 (= "no rest"). Feeds the rest timer and
 * the superset auto-advance decision, so its edge cases are covered by tests.
 */
export function parseRestToSeconds(s: string): number {
  if (!s) return 0;
  s = s.trim().toLowerCase();
  if (/^\d+:\d+$/.test(s)) { const [m, sec] = s.split(':').map(Number); return m * 60 + sec; }
  const minMatch = s.match(/^(\d+(?:\.\d+)?)\s*min?/);
  if (minMatch) return Math.round(parseFloat(minMatch[1]) * 60);
  const secMatch = s.match(/^(\d+(?:\.\d+)?)/);
  if (secMatch) return Math.round(parseFloat(secMatch[1]));
  return 0;
}

/** Seconds -> "M:SS"; empty string when zero (= "no rest"). */
export function secsToRest(sec: number): string {
  if (sec <= 0) return '';
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// ---- Volume ----

/** Compact volume label: kilos, or tonnes to one decimal past 1000kg. */
export function fmtVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
  return `${Math.round(v)}kg`;
}

/** Strength training volume of a day (kg×reps over DONE sets only; skips
 *  recovery/conditioning blocks). */
export function dayVolume(wd: WorkoutDay): number {
  let v = 0;
  for (const ex of wd.exercises) {
    if (ex.recovery || ex.conditioning) continue;
    for (const s of ex.sets) {
      if (!s.done) continue;
      const kg = parseFloat(s.kg);
      const reps = parseInt(s.reps);
      if (!isNaN(kg) && !isNaN(reps)) v += kg * reps;
    }
  }
  return v;
}
