// Coach-notes store (Track 2). Holds the annotation map for the trainee currently
// in view (the trainee's own day in the trainee app, or the open trainee in the
// coach app). Coach-only mutations are optimistic; the trainee never writes.
import { get, writable } from 'svelte/store';
import { listCoachNotes, saveCoachNote, type CoachNote, type NoteAnchor } from '../services/coach';
import { anchorKey, indexNotes } from '../lib/coachNotes';

export { anchorKey } from '../lib/coachNotes';
export type CoachNotesMap = Record<string, CoachNote>;

export const coachNotes = writable<CoachNotesMap>({});

interface Ctx { coachId: string | null; traineeId: string | null; canEdit: boolean; }
let ctx: Ctx = { coachId: null, traineeId: null, canEdit: false };

/** Coach view sets canEdit=true with both ids; trainee view sets canEdit=false. */
export function setCoachNotesContext(c: Ctx): void { ctx = c; }

export function clearCoachNotes(): void {
  ctx = { coachId: null, traineeId: null, canEdit: false };
  coachNotes.set({});
}

/** Load every note anchored to a trainee. RLS narrows the rows to what the
 *  caller may read (coach: their own; trainee: theirs via an accepted link). */
export async function loadCoachNotesFor(traineeId: string): Promise<void> {
  // Fence: a stale load resolving after a trainee switch must not land.
  const dispatchCtx = ctx;
  const list = await listCoachNotes(traineeId);
  if (ctx !== dispatchCtx) return; // view moved on; discard stale rows
  coachNotes.set(indexNotes(list));
}

/** Coach-only: upsert (body) or delete (empty body) a note at an anchor.
 *  Optimistic; reverts the store on failure. No-op if the context can't edit. */
export async function writeCoachNote(
  week: number, day: string, exerciseId: string | null, body: string
): Promise<void> {
  if (!ctx.canEdit || !ctx.coachId || !ctx.traineeId) return;
  const key = anchorKey(week, day, exerciseId);
  const trimmed = body.trim();
  const prev = get(coachNotes);

  coachNotes.update((m) => {
    const next = { ...m };
    if (!trimmed) {
      delete next[key];
    } else {
      next[key] = {
        id: next[key]?.id ?? 'pending',
        week, day, exerciseId, body: trimmed,
        updatedAt: new Date().toISOString(),
      };
    }
    return next;
  });

  try {
    const anchor: NoteAnchor = {
      coachId: ctx.coachId, traineeId: ctx.traineeId, week, day, exerciseId,
    };
    const saved = await saveCoachNote(anchor, trimmed);
    coachNotes.update((m) => {
      const next = { ...m };
      if (saved) next[key] = saved; else delete next[key];
      return next;
    });
  } catch (e) {
    coachNotes.set(prev);
    throw e;
  }
}
