/**
 * sync.ts — Cloud sync infrastructure.
 * Contains: syncStatus, scheduleSave, retry/backoff logic, online flush.
 * No imports from workout-state or ui-state (takes state as parameter).
 */
import { writable } from 'svelte/store';
import type { AppState } from '../types/workout';
import { saveLocal, saveCloud } from '../services/storage';
import { showToast } from './ui-state';

// ---- Cloud sync status ----
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';
export const syncStatus = writable<SyncStatus>('idle');
let syncStatusTimer: ReturnType<typeof setTimeout> | null = null;

export function setSyncStatus(s: SyncStatus) {
  syncStatus.set(s);
  if (syncStatusTimer) clearTimeout(syncStatusTimer);
  if (s === 'saved') syncStatusTimer = setTimeout(() => syncStatus.set('idle'), 2500);
}

// ---- Cloud-save reliability: offline awareness + retry with backoff ----
// Local is always saved synchronously; the cloud copy is the unreliable part.
// On failure we keep the latest pending state and retry with exponential
// backoff, and flush immediately when the browser comes back online.
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCloud: { userId: string; state: AppState } | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 5000;
const RETRY_MAX = 60000;
let failureNotified = false;

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function flushCloud() {
  if (!pendingCloud) return;
  if (isOffline()) { setSyncStatus('error'); return; }
  const { userId, state } = pendingCloud;
  setSyncStatus('saving');
  void saveCloud(userId, state).then((ok) => {
    if (ok) {
      pendingCloud = null;
      retryDelay = 5000;
      failureNotified = false;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      setSyncStatus('saved');
    } else {
      scheduleRetry();
    }
  });
}

function scheduleRetry() {
  setSyncStatus('error');
  if (!failureNotified) {
    showToast('Cloud sync failed — saved locally, will retry', 'error');
    failureNotified = true;
  }
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = null; flushCloud(); }, retryDelay);
  retryDelay = Math.min(retryDelay * 3, RETRY_MAX);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { retryDelay = 5000; flushCloud(); });
}

export function scheduleSave(userId: string, state: AppState, immediate = false) {
  const localOk = saveLocal(userId, state);
  if (!localOk) showToast('Storage full — local save failed. Free up device storage.', 'error');
  pendingCloud = { userId, state };
  if (saveTimer) clearTimeout(saveTimer);
  setSyncStatus('saving');
  if (immediate) {
    saveTimer = null;
    flushCloud();
  } else {
    saveTimer = setTimeout(() => { saveTimer = null; flushCloud(); }, 3000);
  }
}
