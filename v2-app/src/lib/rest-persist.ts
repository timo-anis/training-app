/**
 * Rest-timer persistence codec — pure logic for the localStorage blob that
 * lets a running rest timer (and the superset auto-advance flag) survive
 * screen-off, tab-kill, and WorkoutMode overlay remounts.
 *
 * Blob shape: { s: startTime(ms), t: totalSeconds, adv?: boolean }
 * `adv` records that the rest was started by marking a superset set done,
 * so the superset should auto-advance when this rest ends. The flag used to
 * live only in component state and was lost on every remount — the cause of
 * "timer ended but the superset did not advance".
 */
export interface RestBlob {
  s: number;
  t: number;
  adv: boolean;
}

/** Parse a raw localStorage value. Returns null for missing/corrupt blobs. */
export function decodeRestBlob(raw: string | null): RestBlob | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { s?: unknown; t?: unknown; adv?: unknown };
    if (typeof o?.s !== 'number' || typeof o?.t !== 'number') return null;
    if (!Number.isFinite(o.s) || !Number.isFinite(o.t) || o.t <= 0) return null;
    return { s: o.s, t: o.t, adv: o.adv === true };
  } catch {
    return null;
  }
}

/**
 * A restored blob is usable while the timer is still running OR expired
 * within the grace window (show GO!, wait for the user). Older blobs are
 * stale leftovers and must be dropped.
 */
export function restBlobUsable(blob: RestBlob, now: number, graceSecs = 120): boolean {
  return (now - blob.s) / 1000 < blob.t + graceSecs;
}

/** Serialize for localStorage. */
export function encodeRestBlob(s: number, t: number, adv: boolean): string {
  return JSON.stringify({ s, t, adv });
}
