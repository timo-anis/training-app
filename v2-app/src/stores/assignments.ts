// Coach-assignments store (Track 3). Holds the prescribed-day map for the
// trainee currently in view (the trainee's own coach-plan in the trainee app,
// or the open trainee in the coach app). Coach-only mutations are optimistic;
// the trainee NEVER writes an assignment (they materialize into their own blob).
import { get, writable } from 'svelte/store';
import { listAssignments, saveAssignment, deleteAssignment } from '../services/coach';
import type { Exercise, DayOfWeek } from '../types/workout';
import { assignmentKey, indexAssignments, type Assignment } from '../lib/assignments';

export { assignmentKey } from '../lib/assignments';
export type AssignmentsMap = Record<string, Assignment>;

export const assignments = writable<AssignmentsMap>({});

interface Ctx { coachId: string | null; traineeId: string | null; canEdit: boolean; }
let ctx: Ctx = { coachId: null, traineeId: null, canEdit: false };

/** Coach view sets canEdit=true with both ids; trainee view sets canEdit=false. */
export function setAssignmentContext(c: Ctx): void { ctx = c; }

export function clearAssignments(): void {
  ctx = { coachId: null, traineeId: null, canEdit: false };
  assignments.set({});
}

function toMap(list: Assignment[]): AssignmentsMap {
  const out: AssignmentsMap = {};
  for (const [k, v] of indexAssignments(list)) out[k] = v;
  return out;
}

/** Load every assignment for a trainee. RLS narrows the rows to what the caller
 *  may read (coach: their own; trainee: theirs via an accepted link). */
export async function loadAssignmentsFor(traineeId: string): Promise<void> {
  const list = await listAssignments(traineeId);
  assignments.set(toMap(list));
}

/** Coach-only: upsert a prescribed day. Optimistic; reverts on failure.
 *  No-op if the context can't edit. Empty exercises => remove the plan. */
export async function writeAssignment(
  week: number, day: DayOfWeek, exercises: Exercise[]
): Promise<void> {
  if (!ctx.canEdit || !ctx.coachId || !ctx.traineeId) return;
  if (exercises.length === 0) { await removeAssignment(week, day); return; }
  const key = assignmentKey(week, day);
  const prev = get(assignments);

  assignments.update((m) => ({
    ...m,
    [key]: { id: m[key]?.id ?? 'pending', week, day, exercises, updatedAt: new Date().toISOString() },
  }));

  try {
    const saved = await saveAssignment(ctx.coachId, ctx.traineeId, week, day, exercises);
    assignments.update((m) => ({ ...m, [key]: saved }));
  } catch (e) {
    assignments.set(prev);
    throw e;
  }
}

/** Coach-only: delete a prescribed day. Optimistic; reverts on failure. */
export async function removeAssignment(week: number, day: DayOfWeek): Promise<void> {
  if (!ctx.canEdit || !ctx.coachId || !ctx.traineeId) return;
  const key = assignmentKey(week, day);
  const prev = get(assignments);

  assignments.update((m) => {
    const next = { ...m };
    delete next[key];
    return next;
  });

  try {
    await deleteAssignment(ctx.coachId, ctx.traineeId, week, day);
  } catch (e) {
    assignments.set(prev);
    throw e;
  }
}
