/**
 * coach.ts — Trainer Mode (Track 1) data access.
 *
 * Read-only-for-the-coach by design: the coach never writes a trainee's blob.
 * All state transitions on links go through SECURITY DEFINER RPCs that enforce
 * identity in the database (accept binds auth.uid()+JWT email; revoke checks
 * coach_id OR trainee_id). RLS is the wall; this module just talks to it.
 */
import { supabase } from './supabase';
import { loadCloudWithMeta } from './storage';
import type { AppState } from '../types/workout';
import { relativeAge } from '../lib/freshness';

export { relativeAge };

// ---- Coach-facing rows ----
export interface TraineeRow {
  linkId: string;
  traineeId: string;
  email: string;
  lastTrainedAt: string | null;
  currentWeek: number | null;
  thisWeekActive: boolean;
  summaryUpdatedAt: string | null;
}

export interface PendingInvite {
  id: string;
  email: string;        // invited trainee email
  createdAt: string;
}

// ---- Trainee-facing rows ----
export interface IncomingInvite {
  id: string;
  coachEmail: string | null;
  createdAt: string;
}

export interface MyCoach {
  linkId: string;
  coachEmail: string | null;
  acceptedAt: string | null;
}


// ============================================================
// COACH SIDE
// ============================================================

/** Accepted trainees + their cheap activity projection (no full blobs loaded). */
export async function listTrainees(coachId: string): Promise<TraineeRow[]> {
  const { data: links, error } = await supabase
    .from('coach_links')
    .select('id, trainee_id, invited_email, accepted_at')
    .eq('coach_id', coachId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: true });
  if (error) throw error;
  const rows = links ?? [];
  const ids = rows.map((l) => l.trainee_id).filter(Boolean) as string[];

  const summaries: Record<string, any> = {};
  if (ids.length) {
    const { data: sums } = await supabase
      .from('activity_summary')
      .select('user_id, last_trained_at, current_week, this_week_active, updated_at')
      .in('user_id', ids);
    for (const s of sums ?? []) summaries[s.user_id] = s;
  }

  return rows.map((l) => {
    const s = summaries[l.trainee_id as string];
    return {
      linkId: l.id as string,
      traineeId: l.trainee_id as string,
      email: (l.invited_email as string) ?? '',
      lastTrainedAt: s?.last_trained_at ?? null,
      currentWeek: s?.current_week ?? null,
      thisWeekActive: !!s?.this_week_active,
      summaryUpdatedAt: s?.updated_at ?? null,
    };
  });
}

export async function listPendingInvites(coachId: string): Promise<PendingInvite[]> {
  const { data, error } = await supabase
    .from('coach_links')
    .select('id, invited_email, created_at')
    .eq('coach_id', coachId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    email: r.invited_email as string,
    createdAt: r.created_at as string,
  }));
}

/** Create an invite. Coach writes only their own row (RLS enforced). */
export async function inviteTrainee(coachId: string, coachEmail: string, email: string): Promise<void> {
  const invited = email.trim().toLowerCase();
  if (!invited || !invited.includes('@')) throw new Error('Enter a valid email');
  const { error } = await supabase.from('coach_links').insert({
    coach_id: coachId,
    coach_email: coachEmail,
    invited_email: invited,
    status: 'pending',
  });
  if (error) {
    if ((error as any).code === '23505') throw new Error('You already invited this email');
    throw error;
  }
}

/** Cancel a pending invite (coach-owned, not yet accepted). */
export async function cancelInvite(linkId: string): Promise<void> {
  const { error } = await supabase.from('coach_links').delete().eq('id', linkId);
  if (error) throw error;
}

/** Revoke an accepted link from the coach side (RPC; either party may revoke). */
export async function revokeLink(linkId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_coach_link', { _link_id: linkId });
  if (error) throw error;
}

/** Load a linked trainee's real logged state + cloud freshness (read-only). */
export async function loadTraineeState(
  traineeId: string
): Promise<{ state: AppState | null; updatedAt: string | null }> {
  return loadCloudWithMeta(traineeId);
}

// ============================================================
// TRAINEE SIDE (consumed by the trainee app's Account sheet)
// ============================================================

/** Pending invites addressed to the signed-in trainee's email. */
export async function listIncomingInvites(): Promise<IncomingInvite[]> {
  const { data, error } = await supabase
    .from('coach_links')
    .select('id, coach_email, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    coachEmail: (r.coach_email as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** The trainee's current accepted coach, if any. */
export async function getMyCoach(myUserId: string): Promise<MyCoach | null> {
  const { data, error } = await supabase
    .from('coach_links')
    .select('id, coach_email, accepted_at')
    .eq('trainee_id', myUserId)
    .eq('status', 'accepted')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    linkId: data.id as string,
    coachEmail: (data.coach_email as string) ?? null,
    acceptedAt: (data.accepted_at as string) ?? null,
  };
}

/** 1-tap accept. Binds trainee_id = auth.uid() in the DB (RPC). */
export async function acceptInvite(linkId: string): Promise<void> {
  const { error } = await supabase.rpc('accept_coach_invite', { _link_id: linkId });
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, '') || 'Could not accept invite');
}

/** Trainee revokes their coach instantly. */
export async function revokeMyCoach(linkId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_coach_link', { _link_id: linkId });
  if (error) throw error;
}

// ============================================================
// COACH NOTES (Track 2) — the unified annotation primitive.
// day-level (exerciseId === null) + exercise-level (exerciseId = stable
// Exercise.id) are ONE mechanism. One-way coach -> trainee. The coach writes;
// the trainee only reads (RLS-enforced; see supabase_rls.sql). Reads work for
// BOTH sides via `trainee_id` — RLS narrows to what each caller may see.
// ============================================================

export interface CoachNote {
  id: string;
  week: number;
  day: string;
  exerciseId: string | null;   // null => day-level note
  body: string;
  updatedAt: string | null;
}

const NOTE_COLS = 'id, week, day, exercise_id, body, updated_at';

function rowToNote(r: any): CoachNote {
  return {
    id: r.id as string,
    week: r.week as number,
    day: r.day as string,
    exerciseId: (r.exercise_id ?? null) as string | null,
    body: r.body as string,
    updatedAt: (r.updated_at ?? null) as string | null,
  };
}

/** All notes anchored to a trainee. RLS returns only what the caller may read:
 *  the coach sees their own; the trainee sees theirs via an accepted link. */
export async function listCoachNotes(traineeId: string): Promise<CoachNote[]> {
  const { data, error } = await supabase
    .from('coach_notes')
    .select(NOTE_COLS)
    .eq('trainee_id', traineeId);
  if (error) throw error;
  return (data ?? []).map(rowToNote);
}

export interface NoteAnchor {
  coachId: string;
  traineeId: string;
  week: number;
  day: string;
  exerciseId: string | null;
}

/** Coach upsert by anchor. Empty body => delete (returns null). Coach-only;
 *  RLS rejects any write by a trainee or by a non-accepted coach. */
export async function saveCoachNote(anchor: NoteAnchor, body: string): Promise<CoachNote | null> {
  const trimmed = body.trim();
  if (!trimmed) { await deleteCoachNote(anchor); return null; }
  const { data, error } = await supabase
    .from('coach_notes')
    .upsert(
      {
        coach_id: anchor.coachId,
        trainee_id: anchor.traineeId,
        week: anchor.week,
        day: anchor.day,
        exercise_id: anchor.exerciseId,
        body: trimmed,
      },
      { onConflict: 'coach_id,trainee_id,week,day,exercise_id' }
    )
    .select(NOTE_COLS)
    .single();
  if (error) throw error;
  return rowToNote(data);
}

/** Coach delete by anchor. */
export async function deleteCoachNote(anchor: NoteAnchor): Promise<void> {
  let q = supabase
    .from('coach_notes')
    .delete()
    .eq('coach_id', anchor.coachId)
    .eq('trainee_id', anchor.traineeId)
    .eq('week', anchor.week)
    .eq('day', anchor.day);
  q = anchor.exerciseId === null ? q.is('exercise_id', null) : q.eq('exercise_id', anchor.exerciseId);
  const { error } = await q;
  if (error) throw error;
}
