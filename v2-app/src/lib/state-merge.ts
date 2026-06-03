import type { AppState } from '../types/workout';

/** True when a state actually carries training data. */
export function hasData(s: AppState | null): s is AppState {
  return !!s && Array.isArray(s.weeks) && s.weeks.length > 0;
}

/** Parse an ISO timestamp to epoch ms; unknown/invalid -> 0 (treated as oldest). */
export function tsMs(iso: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Pure boot-merge decision. When both local and cloud have data, the newer
 * timestamp wins; ties go to cloud (the server is the shared source of truth).
 * Otherwise whichever side has data wins; if neither, 'none'.
 */
export function chooseNewer(
  local: AppState | null,
  localTs: string | null,
  cloud: AppState | null,
  cloudTs: string | null
): { state: AppState | null; source: 'local' | 'cloud' | 'none' } {
  const localHas = hasData(local);
  const cloudHas = hasData(cloud);
  if (localHas && cloudHas) {
    return tsMs(localTs) > tsMs(cloudTs)
      ? { state: local, source: 'local' }
      : { state: cloud, source: 'cloud' };
  }
  if (cloudHas) return { state: cloud, source: 'cloud' };
  if (localHas) return { state: local, source: 'local' };
  return { state: null, source: 'none' };
}
