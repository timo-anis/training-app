import { supabase } from './supabase';
import type { AppState } from '../types/workout';
import { emptyAppState } from '../types/workout';
import { parseAndMigrateState } from './state-parser';
import { chooseNewer, hasData } from '../lib/state-merge';
import { sanitizeState } from '../lib/state-sanitize';

// ---- Local storage ----

function localKey(userId: string): string {
  return `timo_training_v4__user__${userId}`;
}

export function loadLocal(userId: string): AppState | null {
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return null;
    return parseAndMigrateState(JSON.parse(raw));
  } catch {
    return null;
  }
}

function localTsKey(userId: string): string {
  return `timo_training_v4__user__${userId}__savedAt`;
}

// D6: session-scoped flag — set when localStorage quota is exhausted.
// bootstrapState reads this to skip the local-wins cloud write-back, so a stale
// local blob (old data, quota prevents updating) is never pushed over a newer
// cloud copy. Cleared when a local save succeeds (user freed up storage).
let _localQuotaExceeded = false;
export function isLocalQuotaExceeded(): boolean { return _localQuotaExceeded; }

// D1: OCC (Optimistic Concurrency Control) for saveCloud.
// We track the server-side updated_at from the last successful cloud load/save.
// saveCloud uses this as a WHERE clause so it refuses to overwrite a cloud row
// that was modified by another device/session since we last synced. After a
// successful save the cursor advances to the new server timestamp so subsequent
// saves continue to work normally.
// _occConflictDetected is a session flag read by sync.ts to show the user a
// "modified on another device — reload to sync" toast without coupling storage
// to UI code.
let _bootCloudTs: string | null = null;
let _occConflictDetected = false;
export function setBootCloudTs(ts: string | null): void { _bootCloudTs = ts; }
export function wasOccConflict(): boolean { return _occConflictDetected; }
export function clearOccConflict(): void { _occConflictDetected = false; }

export function saveLocal(userId: string, state: AppState): boolean {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(state));
    localStorage.setItem(localTsKey(userId), new Date().toISOString());
    _localQuotaExceeded = false; // storage freed — clear the flag
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      _localQuotaExceeded = true;
      console.error('localStorage quota exceeded — local save failed', e);
    } else {
      console.error('Local save failed', e);
    }
    return false;
  }
}

/** Last local-save timestamp (ISO) for this user, or null if never saved / unknown. */
export function loadLocalTimestamp(userId: string): string | null {
  try {
    return localStorage.getItem(localTsKey(userId));
  } catch {
    return null;
  }
}

// ---- Cloud storage (Supabase) ----

export async function loadCloud(userId: string): Promise<AppState | null> {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('state_json')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data?.state_json) return null;
    return parseAndMigrateState(data.state_json);
  } catch (e) {
    console.error('Cloud load failed', e);
    return null;
  }
}

/** Cloud state plus its server updated_at timestamp (ISO), for newer-wins merge.
 *  Retries up to 3 times with exponential backoff so a transient network hiccup
 *  (common at PWA boot after iOS evicts the app) doesn't silently return null and
 *  cause the user to see an empty training log. Throws on persistent failure so the
 *  caller can surface a proper error instead of showing a blank state.
 */
export async function loadCloudWithMeta(
  userId: string
): Promise<{ state: AppState | null; updatedAt: string | null }> {
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { data, error } = await supabase
        .from('app_state')
        .select('state_json, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data?.state_json) return { state: null, updatedAt: null };
      return {
        state: parseAndMigrateState(data.state_json),
        updatedAt: (data.updated_at as string | null) ?? null,
      };
    } catch (e) {
      lastError = e;
      console.error(`Cloud load attempt ${attempt + 1}/${MAX_ATTEMPTS} failed`, e);
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export async function saveCloud(userId: string, state: AppState): Promise<boolean> {
  // Safety guard: never overwrite cloud with an empty state.
  if (!hasData(state)) {
    console.warn('saveCloud blocked: refusing to overwrite cloud with empty state');
    return false;
  }
  try {
    if (_bootCloudTs !== null) {
      // OCC path: only update the row if updated_at still matches what we loaded.
      // The BEFORE UPDATE trigger (set_updated_at) sets updated_at = now() on the
      // server side; we select it back so the cursor stays current for the next save.
      const { data, error } = await supabase
        .from('app_state')
        .update({ state_json: state })
        .eq('user_id', userId)
        .eq('updated_at', _bootCloudTs)
        .select('updated_at');
      if (error) throw error;
      if (!data || data.length === 0) {
        // 0 rows matched: another session updated the row since our last sync.
        console.warn('OCC conflict: cloud row was modified since last sync — save blocked');
        _occConflictDetected = true;
        return false;
      }
      // Advance the cursor to the new server-generated timestamp.
      _bootCloudTs = (data[0] as { updated_at: string }).updated_at;
      return true;
    } else {
      // First-save path: no cloud row existed at boot (new user or first sync).
      // Upsert is safe here because we never loaded a competing cloud version.
      const { data, error } = await supabase
        .from('app_state')
        .upsert({ user_id: userId, state_json: state }, { onConflict: 'user_id' })
        .select('updated_at');
      if (error) throw error;
      // Capture the server-generated timestamp so subsequent saves use the OCC path.
      _bootCloudTs = (data?.[0] as { updated_at: string } | undefined)?.updated_at ?? null;
      return true;
    }
  } catch (e) {
    console.error('Cloud save failed', e);
    return false;
  }
}

// ---- Bootstrap: load for signed-in user ----
// Newer of local vs cloud wins (by timestamp). Prevents a stale cloud copy from
// silently overwriting newer local edits (e.g. made offline) on boot.

export async function bootstrapState(userId: string): Promise<AppState> {
  const local = loadLocal(userId);
  const localTs = loadLocalTimestamp(userId);

  // Cloud fetch with retry. If the network persistently fails we catch it here
  // so we can distinguish "no data" (new user) from "fetch failed" (error state).
  let cloud: { state: AppState | null; updatedAt: string | null };
  let cloudFailed = false;
  try {
    cloud = await loadCloudWithMeta(userId);
  } catch (e) {
    console.error('Cloud load failed after all retries — falling back to local', e);
    cloud = { state: null, updatedAt: null };
    cloudFailed = true;
  }

  // Record the cloud timestamp so saveCloud can use OCC on subsequent saves.
  setBootCloudTs(cloud.updatedAt);

  const choice = chooseNewer(local, localTs, cloud.state, cloud.updatedAt);

  // If cloud persistently failed AND we have no local fallback, throw so bootForUser
  // sets bootStatus='error' and the UI shows "Couldn't load data / Reload" instead
  // of silently presenting an empty training log that looks like a new user.
  if (cloudFailed && !hasData(choice.state)) {
    throw new Error('Failed to load training data. Check your connection and try again.');
  }

  // Local was newer → push a sanitized copy to cloud so cloud catches up.
  // Skip if quota was exceeded this session: local may be stale (couldn't be updated)
  // and we must not push that stale blob over a cloud copy that IS up-to-date.
  if (choice.source === 'local' && hasData(cloud.state) && choice.state && !isLocalQuotaExceeded()) {
    void saveCloud(userId, sanitizeState(choice.state));
  }

  return choice.state ?? emptyAppState();
}
