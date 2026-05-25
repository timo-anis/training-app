import { supabase } from './supabase';
import type { AppState } from '../types/workout';
import { emptyAppState } from '../types/workout';
import { parseAndMigrateState } from './migrator';

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

export function saveLocal(userId: string, state: AppState): void {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(state));
  } catch (e) {
    console.error('Local save failed', e);
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
// Cloud wins if it has data. Falls back to local. Falls back to empty.

export async function bootstrapState(userId: string): Promise<AppState> {
  const cloud = await loadCloud(userId);
  if (cloud && cloud.weeks.length > 0) return cloud;

  const local = loadLocal(userId);
  if (local && local.weeks.length > 0) return local;

  return emptyAppState();
}
