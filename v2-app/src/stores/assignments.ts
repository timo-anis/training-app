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
  // Fence: set…Context/clear… replace the ctx object, so a mid-flight trainee
  // switch changes identity. A stale load must never land in the NEW view's map.
  const dispatchCtx = ctx;
  const list = await listAssignments(traineeId);
  if (ctx !== dispatchCtx) return; // view moved on; discard stale rows
  assignments.set(toMap(list));
}

/** Identity of the trainee context currently receiving writes, or null.
 *  Lets long-running flows (copy-week) detect a mid-flight trainee switch. */
export function assignmentCtxId(): string | null {
  return ctx.canEdit && ctx.coachId && ctx.traineeId ? `${ctx.coachId}|${ctx.traineeId}` : null;
}

/** Coach-only: upsert a prescribed day. Optimistic; reverts on failure.
 *  Returns false when the context can't edit (silent no-op) — callers that
 *  must not miscount a no-op as success (copy-week) check the result.
 *  Empty exercises => remove the plan. */
export async function writeAssignment(
  week: number, day: DayOfWeek, exercises: Exercise[]
): Promise<boolean> {
  // Fence: setAssignmentContext/clearAssignments replace the ctx object, so a
  // mid-flight trainee switch changes identity. A straddling write must never
  // mutate the NEW trainee's map (success) or restore the OLD trainee's
  // snapshot over it (failure).
  const dispatchCtx = ctx;
  const { coachId, traineeId } = dispatchCtx;
  if (!dispatchCtx.canEdit || !coachId || !traineeId) return false;
  if (exercises.length === 0) { await removeAssignment(week, day); return true; }
  const key = assignmentKey(week, day);
  const prev = get(assignments);

  assignments.update((m) => ({
    ...m,
    [key]: { id: m[key]?.id ?? 'pending', week, day, exercises, updatedAt: new Date().toISOString() },
  }));

  try {
    const saved = await saveAssignment(coachId, traineeId, week, day, exercises);
    if (ctx !== dispatchCtx) return false; // view moved on; server row saved, map untouched
    assignments.update((m) => ({ ...m, [key]: saved }));
    return true;
  } catch (e) {
    if (ctx === dispatchCtx) assignments.set(prev);
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

  const dispatchCtx = ctx;
  try {
    await deleteAssignment(ctx.coachId, ctx.traineeId, week, day);
  } catch (e) {
    if (ctx === dispatchCtx) assignments.set(prev);
    throw e;
  }
}
