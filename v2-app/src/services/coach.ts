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
    const { data: sums, error: sumErr } = await supabase
      .from('activity_summary')
      .select('user_id, last_trained_at, current_week, this_week_active, updated_at')
      .in('user_id', ids);
    // Non-fatal: dashboard still lists trainees, just without freshness (L2 audit fix).
    if (sumErr) console.warn('activity_summary load failed; showing trainees without freshness', sumErr);
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
  if (invited === (coachEmail ?? '').trim().toLowerCase()) {
    throw new Error("You can't invite yourself as a trainee");
  }
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

/** Pending invites addressed to the signed-in trainee's email.
 *  RLS (links_invitee_select) is the authoritative filter; the
 *  email clause here is defence-in-depth so even a misconfigured
 *  policy can never leak another user's invites to the client. */
export async function listIncomingInvites(): Promise<IncomingInvite[]> {
  // Fetch caller identity for the client-side defence-in-depth filter.
  const { data: { user } } = await supabase.auth.getUser();
  const myEmail = (user?.email ?? '').toLowerCase();

  let q = supabase
    .from('coach_links')
    .select('id, coach_email, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (myEmail) q = q.eq('invited_email', myEmail);

  const { data, error } = await q;
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

interface CoachNoteRow {
  id: string;
  week: number;
  day: string;
  exercise_id: string | null;
  body: string;
  updated_at: string | null;
}

function rowToNote(r: CoachNoteRow): CoachNote {
  return {
    id: r.id,
    week: r.week,
    day: r.day,
    exerciseId: r.exercise_id ?? null,
    body: r.body,
    updatedAt: r.updated_at ?? null,
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

// ============================================================
// COACH ASSIGNMENTS (Track 3) — program authoring.
// The coach authors FUTURE days (same exercises[] shape as a workout day) into
// public.coach_assignments. One-way coach -> trainee. The coach writes; the
// trainee reads via an accepted link and MATERIALIZES into their OWN blob on
// first touch (only the trainee's client writes app_state -> single-writer).
// RLS narrows reads per caller; writes are coach-only (see supabase_rls.sql).
// ============================================================
import type { Exercise } from '../types/workout';
import type { Assignment } from '../lib/assignments';
export type { Assignment };

const ASSIGN_COLS = 'id, week, day, payload, updated_at';

interface AssignmentRow {
  id: string;
  week: number;
  day: string;
  payload: { exercises: unknown[] };
  updated_at: string | null;
}

function rowToAssignment(r: AssignmentRow): Assignment {
  const exercises = Array.isArray(r.payload?.exercises) ? (r.payload.exercises as Exercise[]) : [];
  return {
    id: r.id,
    week: r.week,
    day: r.day as Assignment['day'],
    exercises,
    updatedAt: r.updated_at ?? null,
  };
}

/** All assignments for a trainee. RLS returns only what the caller may read:
 *  the coach sees their own; the trainee sees theirs via an accepted link. */
export async function listAssignments(traineeId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('coach_assignments')
    .select(ASSIGN_COLS)
    .eq('trainee_id', traineeId);
  if (error) throw error;
  return (data ?? []).map(rowToAssignment);
}

/** Coach upsert of a prescribed day by anchor (coach_id, trainee_id, week, day).
 *  Coach-only; RLS rejects any write by a trainee or a non-accepted coach. */
export async function saveAssignment(
  coachId: string,
  traineeId: string,
  week: number,
  day: string,
  exercises: Exercise[]
): Promise<Assignment> {
  const { data, error } = await supabase
    .from('coach_assignments')
    .upsert(
      { coach_id: coachId, trainee_id: traineeId, week, day, payload: { exercises } },
      { onConflict: 'coach_id,trainee_id,week,day' }
    )
    .select(ASSIGN_COLS)
    .single();
  if (error) throw error;
  return rowToAssignment(data);
}

/** Coach delete of a prescribed day by anchor. */
export async function deleteAssignment(
  coachId: string,
  traineeId: string,
  week: number,
  day: string
): Promise<void> {
  const { error } = await supabase
    .from('coach_assignments')
    .delete()
    .eq('coach_id', coachId)
    .eq('trainee_id', traineeId)
    .eq('week', week)
    .eq('day', day);
  if (error) throw error;
}

// ============================================================
// CHAT (Track 4) — the relationship layer. The ONLY two-way layer.
// Link-scoped messages between an accepted coach and trainee. Both parties
// read AND write only their own link's thread (RLS-enforced; sender bound to
// auth.uid()). Messages are immutable from the client; read receipts go through
// the mark_messages_read RPC. Realtime is opt-in per link. Single-writer
// preserved: messages is its own table and never touches app_state.
// ============================================================
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  type ChatMessage, tallyUnreadByLink,
} from '../lib/messages';
export type { ChatMessage };

const MSG_COLS = 'id, link_id, sender_id, body, created_at, read_at';

interface MessageRow {
  id: string;
  link_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

function rowToMessage(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    linkId: r.link_id,
    senderId: r.sender_id,
    body: r.body,
    createdAt: r.created_at,
    readAt: r.read_at ?? null,
  };
}

/** Full thread for a link, oldest-first. RLS returns rows only to the two
 *  participants of an accepted link; everyone else (and post-revoke) sees none. */
export async function listMessages(linkId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(MSG_COLS)
    .eq('link_id', linkId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToMessage);
}

/** Send a message. sender_id is checked against auth.uid() by RLS; the DB also
 *  guards a non-empty body (<=4000). Returns the persisted row. */
export async function sendMessage(linkId: string, senderId: string, body: string): Promise<ChatMessage> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Empty message');
  const { data, error } = await supabase
    .from('messages')
    .insert({ link_id: linkId, sender_id: senderId, body: trimmed.slice(0, 4000) })
    .select(MSG_COLS)
    .single();
  if (error) throw error;
  return rowToMessage(data);
}

/** Mark every message I RECEIVED on this link as read (narrow SECURITY DEFINER
 *  RPC; only the recipient's rows are touched). Returns the count marked. */
export async function markMessagesRead(linkId: string): Promise<number> {
  const { data, error } = await supabase.rpc('mark_messages_read', { _link_id: linkId });
  if (error) throw error;
  return (data as number) ?? 0;
}

/** Unread-from-peer counts per link for the signed-in user (dashboard badges).
 *  RLS scopes the rows to the caller's links; we tally what isn't ours. */
export async function listUnreadCounts(myUserId: string): Promise<Record<string, number>> {
  // limit: prevents unbounded fetches on accounts with many messages.
  // 500 unread messages across all links is already an extreme edge case.
  const { data, error } = await supabase
    .from('messages')
    .select('link_id, sender_id, read_at')
    .is('read_at', null)
    .limit(500);
  if (error) throw error;
  const rows = (data ?? []).map((r) => ({
    linkId: r.link_id as string,
    senderId: r.sender_id as string,
    readAt: (r.read_at ?? null) as string | null,
  }));
  return tallyUnreadByLink(rows, myUserId);
}

/** Live updates for a link's thread. RLS applies to realtime too, so only the
 *  two participants receive events. Returns an unsubscribe fn. */
export function subscribeToMessages(
  linkId: string,
  handlers: { onInsert?: (m: ChatMessage) => void; onUpdate?: (m: ChatMessage) => void },
  channelKey = `messages:${linkId}`
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(channelKey)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `link_id=eq.${linkId}` },
      (payload) => handlers.onInsert?.(rowToMessage(payload.new as MessageRow))
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `link_id=eq.${linkId}` },
      (payload) => handlers.onUpdate?.(rowToMessage(payload.new as MessageRow))
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

/** Like subscribeToMessages but UNFILTERED — fires for any message the caller can
 *  see (RLS scopes to their links). Used by the coach dashboard to keep unread
 *  badges live across all trainees. Returns an unsubscribe fn. */
export function subscribeToAllMessages(
  handlers: { onInsert?: (m: ChatMessage) => void; onUpdate?: (m: ChatMessage) => void },
  channelKey = 'messages:all'
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(channelKey)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => handlers.onInsert?.(rowToMessage(payload.new as MessageRow))
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      (payload) => handlers.onUpdate?.(rowToMessage(payload.new as MessageRow))
    )
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
