import { supabase } from './supabase';
import type { AppState } from '../types/workout';
import { emptyAppState } from '../types/workout';
import { parseAndMigrateState } from './migrator';
import { chooseNewer, hasData } from '../lib/state-merge';

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

export function saveLocal(userId: string, state: AppState): void {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(state));
    localStorage.setItem(localTsKey(userId), new Date().toISOString());
  } catch (e) {
    console.error('Local save failed', e);
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
    // parseAndMigrateState handles both MVP1 flat format and V2 structured format
    return parseAndMigrateState(data.state_json);
  } catch (e) {
    console.error('Cloud load failed', e);
    return null;
  }
}

/** Cloud state plus its server updated_at timestamp (ISO), for newer-wins merge. */
export async function loadCloudWithMeta(
  userId: string
): Promise<{ state: AppState | null; updatedAt: string | null }> {
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
    console.error('Cloud load (meta) failed', e);
    return { state: null, updatedAt: null };
  }
}

export async function saveCloud(userId: string, state: AppState): Promise<boolean> {
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
  const cloud = await loadCloudWithMeta(userId);
  const local = loadLocal(userId);
  const localTs = loadLocalTimestamp(userId);

  const choice = chooseNewer(local, localTs, cloud.state, cloud.updatedAt);

  // If newer local won over an existing (older) cloud copy, push it up so the
  // cloud catches up — fire-and-forget; local already holds the truth.
  if (choice.source === 'local' && hasData(cloud.state) && choice.state) {
    void saveCloud(userId, choice.state);
  }

  return choice.state ?? emptyAppState();
}

// ---- MVP1 → V2 migration from local storage ----
// MVP1 stored data under "timo_training_v81_real__user__{userId}" (or global key).
// Returns migrated AppState or null if no MVP1 data found.

const MVP1_KEYS = (userId: string) => [
  `timo_training_v81_real__user__${userId}`,
  'timo_training_v81_real',
];

export function detectMvp1Data(userId: string): boolean {
  return MVP1_KEYS(userId).some(k => {
    try { return !!localStorage.getItem(k); } catch { return false; }
  });
}

export function importFromMvp1(userId: string): AppState | null {
  for (const key of MVP1_KEYS(userId)) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const migrated = parseAndMigrateState(parsed);
      if (migrated && migrated.weeks.length > 0) return migrated;
    } catch {
      continue;
    }
  }
  return null;
}
