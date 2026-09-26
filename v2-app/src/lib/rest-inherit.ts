/**
 * rest-inherit.ts — last-used rest time per exercise, for copy-day.
 *
 * Copying a day carried each exercise's `rest` verbatim — but in real data most
 * source days had an EMPTY rest (341 of 633 copied exercises), so copies arrived
 * without rest times and had to be re-entered by hand. addExercise() already
 * inherits the last rest used for the same exercise; copy now does the same,
 * but only to FILL an empty rest — an explicit rest on the source always wins.
 *
 * "Last used" = chronologically latest (week, then Mon→Sun) non-empty rest.
 * Names match case-insensitively after trimming, like addExercise.
 */
import type { WorkoutDay, Exercise } from '../types/workout';
import { DAY_ORDER } from '../types/workout';

export function restKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Map of restKey(name) → the most recent non-empty rest across all days. */
export function latestRestByName(weeks: readonly WorkoutDay[]): Map<string, string> {
  const ordered = [...weeks].sort((a, b) =>
    a.week - b.week || DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
  const out = new Map<string, string>();
  for (const wd of ordered) {
    for (const ex of wd.exercises) {
      if (ex.rest && ex.rest.trim() !== '') out.set(restKey(ex.name), ex.rest);
    }
  }
  return out;
}

/** The rest a copied exercise should carry: its own if set, else the last used one, else ''. */
export function restForCopy(ex: Pick<Exercise, 'name' | 'rest'>, latest: Map<string, string>): string {
  if (ex.rest && ex.rest.trim() !== '') return ex.rest;
  return latest.get(restKey(ex.name)) ?? '';
}
