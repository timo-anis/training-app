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

export function saveLocal(userId: string, state: AppState): boolean {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(state));
    localStorage.setItem(localTsKey(userId), new Date().toISOString());
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
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
  // Uses hasData() — the canonical check — rather than weeks.length so that if
  // hasData() is ever strengthened the guard automatically benefits.
  if (!hasData(state)) {
    console.warn('saveCloud blocked: refusing to overwrite cloud with empty state');
    return false;
  }
  try {
    const { error } = await supabase
      .from('app_state')
      .upsert(
        { user_id: userId, state_json: state, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (error) throw error;
    return true;
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

  const choice = chooseNewer(local, localTs, cloud.state, cloud.updatedAt);

  // If cloud persistently failed AND we have no local fallback, throw so bootForUser
  // sets bootStatus='error' and the UI shows "Couldn't load data / Reload" instead
  // of silently presenting an empty training log that looks like a new user.
  if (cloudFailed && !hasData(choice.state)) {
    throw new Error('Failed to load training data. Check your connection and try again.');
  }

  // Local was newer → push a sanitized copy to cloud so cloud catches up.
  // Apply sanitizeState here so dirty exercise names in local can't re-infect cloud.
  if (choice.source === 'local' && hasData(cloud.state) && choice.state) {
    void saveCloud(userId, sanitizeState(choice.state));
  }

  return choice.state ?? emptyAppState();
}
