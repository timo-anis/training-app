// Pure helpers for the chat layer (Track 4). No side effects / no Supabase —
// safe to unit-test in isolation. Chat is the ONLY two-way trainer-mode layer.

export interface ChatMessage {
  id: string;
  linkId: string;
  senderId: string;
  body: string;
  createdAt: string;       // ISO timestamp
  readAt: string | null;   // set once the recipient has seen it
}

/** Ascending by created_at, tie-broken by id for a stable, deterministic order. */
export function sortMessages(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => {
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Upsert a message by id (realtime INSERT/UPDATE or local echo), kept sorted.
 *  Idempotent: a duplicate realtime event replaces in place, never doubles. */
export function mergeMessage(list: ChatMessage[], msg: ChatMessage): ChatMessage[] {
  const next = list.filter((m) => m.id !== msg.id);
  next.push(msg);
  return sortMessages(next);
}

/** Replace an optimistic temp row (oldId) with the server row. If the server
 *  row already arrived via realtime, this de-dupes to a single entry. */
export function replaceMessage(list: ChatMessage[], oldId: string, msg: ChatMessage): ChatMessage[] {
  return mergeMessage(list.filter((m) => m.id !== oldId), msg);
}

/** Is this message authored by me? */
export function isMine(msg: ChatMessage, myUserId: string): boolean {
  return msg.senderId === myUserId;
}

/** Unread messages I RECEIVED (sent by the peer, not yet read). Drives badges. */
export function unreadFromPeer(list: ChatMessage[], myUserId: string): number {
  let n = 0;
  for (const m of list) if (m.senderId !== myUserId && !m.readAt) n++;
  return n;
}

/** Tally unread-from-peer per link from a flat row set (coach dashboard badges).
 *  RLS already scopes rows to the caller's links; we just count what isn't mine. */
export function tallyUnreadByLink(
  rows: { linkId: string; senderId: string; readAt: string | null }[],
  myUserId: string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.senderId === myUserId || r.readAt) continue;
    out[r.linkId] = (out[r.linkId] ?? 0) + 1;
  }
  return out;
}
