// Chat store (Track 4). Holds the thread for the ONE link currently in view
// (the trainee messaging their coach, or the coach messaging the open trainee).
// Two-way: both sides write. Sends are optimistic and revert on failure. The
// store owns the realtime subscription lifecycle.
import { get, writable, derived } from 'svelte/store';
import {
  listMessages, sendMessage, markMessagesRead, subscribeToMessages, type ChatMessage,
} from '../services/coach';
import { sortMessages, mergeMessage, replaceMessage, unreadFromPeer } from '../lib/messages';

export type { ChatMessage };

export const chatMessages = writable<ChatMessage[]>([]);

interface Ctx { linkId: string | null; myUserId: string | null; }
let ctx: Ctx = { linkId: null, myUserId: null };
let unsub: (() => void) | null = null;

/** Unread-from-peer for the open thread (live; drives the in-view badge). */
export const chatUnread = derived(chatMessages, ($m) =>
  ctx.myUserId ? unreadFromPeer($m, ctx.myUserId) : 0
);

export function setChatContext(c: Ctx): void { ctx = c; }

export function clearChat(): void {
  unsub?.(); unsub = null;
  ctx = { linkId: null, myUserId: null };
  chatMessages.set([]);
}

/** Load the thread and attach realtime. Safe to call once per view open. */
export async function loadChat(): Promise<void> {
  if (!ctx.linkId) return;
  const list = await listMessages(ctx.linkId);
  chatMessages.set(sortMessages(list));
  unsub?.();
  unsub = subscribeToMessages(ctx.linkId, {
    onInsert: (m) => chatMessages.update((cur) => mergeMessage(cur, m)),
    onUpdate: (m) => chatMessages.update((cur) => mergeMessage(cur, m)),
  });
}

/** Optimistic send: echo locally, persist, reconcile the temp row. Reverts and
 *  rethrows on failure so the UI can surface it. No-op without a context. */
export async function sendChat(body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed || !ctx.linkId || !ctx.myUserId) return;
  const tempId = `pending-${(globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random()))}`;
  const optimistic: ChatMessage = {
    id: tempId, linkId: ctx.linkId, senderId: ctx.myUserId,
    body: trimmed, createdAt: new Date().toISOString(), readAt: null,
  };
  const prev = get(chatMessages);
  chatMessages.update((cur) => mergeMessage(cur, optimistic));
  try {
    const saved = await sendMessage(ctx.linkId, ctx.myUserId, trimmed);
    chatMessages.update((cur) => replaceMessage(cur, tempId, saved));
  } catch (e) {
    chatMessages.set(prev);
    throw e;
  }
}

/** Mark received messages read (best-effort; read receipts never block use). */
export async function markChatRead(): Promise<void> {
  if (!ctx.linkId || !ctx.myUserId) return;
  const me = ctx.myUserId;
  try {
    await markMessagesRead(ctx.linkId);
    const stamp = new Date().toISOString();
    chatMessages.update((cur) =>
      cur.map((m) => (m.senderId !== me && !m.readAt ? { ...m, readAt: stamp } : m))
    );
  } catch { /* best-effort */ }
}
