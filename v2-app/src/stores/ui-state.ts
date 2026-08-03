/**
 * ui-state.ts — UI-only state with no dependency on other store modules.
 * Contains: theme, currentUser, auth access control, uiState, bootStatus,
 * toast, search/sheet/onboarding flags, undo system, updateUI.
 */
import { writable, derived, get } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import type { UIState } from '../types/workout';
import { DAY_ORDER } from '../types/workout';

// ---- Theme (dark | presentation) ----
export type Theme = 'dark' | 'presentation';
const THEME_KEY = 'timo_training_theme';
function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'presentation' ? 'presentation' : 'dark';
  } catch {
    return 'dark';
  }
}
export const theme = writable<Theme>(readTheme());
function applyTheme(t: Theme) {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = t;
  }
}
theme.subscribe((t) => {
  applyTheme(t);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch { /* ignore */ }
});
export function toggleTheme() {
  theme.update((t) => (t === 'presentation' ? 'dark' : 'presentation'));
}

// ---- Auth store ----
export const currentUser = writable<User | null>(null);
/** User's chosen display name, loaded from profiles on sign-in. */
export const displayName = writable<string>('');

// ---- Presentation-mode access control (allow-list) ----
import { PRESENTATION_EMAILS } from '../data/config';
function presentationAllowed(u: User | null): boolean {
  return !!u && PRESENTATION_EMAILS.includes((u.email ?? '').toLowerCase());
}
export const canUsePresentation = derived(currentUser, ($u) => presentationAllowed($u));
// Any signed-in user who is not on the allow-list is forced to the dark theme.
currentUser.subscribe(($u) => {
  if ($u && !presentationAllowed($u)) {
    theme.set('dark');
  }
});

// ---- UI nav persistence ----
const UI_NAV_KEY = 'timo_ui_nav';

export interface StoredNav {
  week: number;
  day: string;
  radarMode: 'day' | 'week';
  calendarCollapsed: boolean;
  savedAt?: string; // Date.toDateString() — used to detect cross-day session
}

export function loadStoredNav(): StoredNav | null {
  try {
    const raw = localStorage.getItem(UI_NAV_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p.week === 'number' && typeof p.day === 'string') return p as StoredNav;
  } catch { /* ignore */ }
  return null;
}

function saveNavState(week: number, day: string, radarMode: UIState['radarMode'], calendarCollapsed: boolean) {
  try {
    localStorage.setItem(UI_NAV_KEY, JSON.stringify({ week, day, radarMode, calendarCollapsed, savedAt: new Date().toDateString() }));
  } catch { /* ignore */ }
}

// ---- UI state store ----
const today = new Date();
const defaultDay = DAY_ORDER[today.getDay() === 0 ? 6 : today.getDay() - 1];
const _storedNav = loadStoredNav();
// Mutable snapshot captured at module init — before subscribe overwrites localStorage.
// Cleared on sign-out so the next bootForUser always lands on today.
let _navSnapshot: StoredNav | null = _storedNav;
export function getStoredNavSnapshot(): StoredNav | null { return _navSnapshot; }
/** Call on SIGNED_OUT — clears nav position so next login boots to today. */
export function clearStoredNavSnapshot(): void {
  _navSnapshot = null;
  try { localStorage.removeItem(UI_NAV_KEY); } catch { /* ignore */ }
}
export const uiState = writable<UIState>({
  week: _storedNav?.week ?? 1,
  day: (_storedNav?.day ?? defaultDay) as UIState['day'],
  search: '',
  workoutActive: false,
  workoutMode: false,
  activeExerciseIndex: 0,
  radarMode: (_storedNav?.radarMode ?? 'day') as UIState['radarMode'],
  calendarCollapsed: _storedNav?.calendarCollapsed ?? false,
  workoutStartTime: null,
  restStartTime: null,
  restTotal: null,
  highlightExercise: null,
});

// Persist nav position on every change (week, day, radarMode, calendarCollapsed)
uiState.subscribe(ui => {
  if (ui.week && ui.day) {
    saveNavState(ui.week, ui.day, ui.radarMode, ui.calendarCollapsed);
  }
});

// ---- Boot status ----
export type BootStatus = 'idle' | 'loading' | 'ready' | 'error';
export const bootStatus = writable<BootStatus>('idle');

// ---- Toast notifications ----
export interface Toast { msg: string; type: 'error' | 'success' | 'info'; }
export const toast = writable<Toast | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string, type: Toast['type'] = 'info') {
  if (toastTimer) clearTimeout(toastTimer);
  toast.set({ msg, type });
  toastTimer = setTimeout(() => toast.set(null), 4000);
}

// ---- Search overlay (global, rendered at App level) ----
export const searchOpen = writable<boolean>(false);

// ---- Sheet open (account, etc.) — hides workout bar ----
export const sheetOpen = writable<boolean>(false);

// Set true from anywhere to (re)open the onboarding walkthrough
export const requestOnboarding = writable<boolean>(false);

/** Account sheet overlay open state — read by App.svelte to render outside scroll-content. */
export const accountOpen = writable<boolean>(false);

/** Quick guide overlay open state — read by App.svelte to render outside scroll-content. */
export const hintsOpen = writable<boolean>(false);
/** Personal records overlay open state — read by App.svelte to render outside scroll-content. */
export const recordsOpen = writable<boolean>(false);
/** Recovery status sheet open state — read by App.svelte to render outside scroll-content. */
export const recoveryOpen = writable<boolean>(false);
export const statsOpen    = writable<boolean>(false);

// ---- Biometric app-open lock ----
import { initLock, reduceLock, unlockedModel, type LockModel } from '../lib/lock';
import { clearCredentialId } from '../services/biometric';

const LOCK_ENABLED_PREFIX = 'timo_biolock_enabled__';
function lockEnabledKey(userId: string): string {
  return `${LOCK_ENABLED_PREFIX}${userId}`;
}
/** Read the per-user lock preference from localStorage. */
export function readLockEnabled(userId: string): boolean {
  try {
    return localStorage.getItem(lockEnabledKey(userId)) === '1';
  } catch {
    return false;
  }
}
function writeLockEnabled(userId: string, on: boolean): void {
  try {
    if (on) localStorage.setItem(lockEnabledKey(userId), '1');
    else localStorage.removeItem(lockEnabledKey(userId));
  } catch { /* ignore */ }
}

// Per-user "last active" timestamp. Written when the app backgrounds or unlocks
// so a cold boot (e.g. an iOS PWA that iOS suspended and reloaded on an
// app-switch) can tell how long the user was really away and skip the Face ID
// prompt inside the grace window. See lib/lock.ts BG_RELOCK_MS.
const LOCK_LASTACTIVE_PREFIX = 'timo_biolock_lastactive__';
function lastActiveKey(userId: string): string {
  return `${LOCK_LASTACTIVE_PREFIX}${userId}`;
}
function readLastActive(userId: string): number | null {
  try {
    const raw = localStorage.getItem(lastActiveKey(userId));
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
function writeLastActive(userId: string, now: number): void {
  try {
    localStorage.setItem(lastActiveKey(userId), String(now));
  } catch { /* ignore */ }
}

// The user the lock model currently belongs to, so background/unlock events know
// whose timestamp to stamp. Set on boot, cleared on sign-out.
let lockUserId: string | null = null;

/** Full lock state machine model (see lib/lock.ts). Starts fully open. */
export const lockModel = writable<LockModel>(unlockedModel());
/** True => the app must show the biometric lock screen. */
export const appLocked = derived(lockModel, (m) => m.phase === 'locked');
/** True => the lock feature is enabled for the current user. */
export const lockEnabled = derived(lockModel, (m) => m.enabled);

/** Boot the lock for a signed-in user: locks immediately iff the pref is on. */
export function initLockForUser(userId: string, now: number = Date.now()): void {
  lockUserId = userId;
  const enabled = readLockEnabled(userId);
  lockModel.set(
    reduceLock(initLock(enabled), { t: 'boot', now, lastActiveAt: readLastActive(userId) })
  );
}
/** Sign-out reset: never gate the auth screen. */
export function resetLock(): void {
  lockUserId = null;
  lockModel.set(unlockedModel());
}
/** Biometric verify succeeded — open the gate. */
export function unlockOk(now: number = Date.now()): void {
  if (lockUserId) writeLastActive(lockUserId, now);
  lockModel.update((m) => reduceLock(m, { t: 'unlock-ok' }));
}
/** Biometric verify failed/cancelled — stay locked, allow retry. */
export function unlockFail(): void {
  lockModel.update((m) => reduceLock(m, { t: 'unlock-fail' }));
}
/** App backgrounded. */
export function noteHidden(now: number = Date.now()): void {
  if (lockUserId) writeLastActive(lockUserId, now);
  lockModel.update((m) => reduceLock(m, { t: 'hide', now }));
}
/** App foregrounded — re-locks if it was away longer than the threshold. */
export function noteResumed(now: number = Date.now()): void {
  lockModel.update((m) => reduceLock(m, { t: 'resume', now }));
}
/** Toggle the feature for a user. Turning off clears the stored credential handle. */
export function setLockEnabledForUser(userId: string, on: boolean): void {
  writeLockEnabled(userId, on);
  if (!on) clearCredentialId(userId);
  lockModel.update((m) => reduceLock(m, { t: 'set-enabled', enabled: on }));
}

// ---- Global undo ----
export interface UndoAction { label: string; fn: () => void; }
export const undoAction = writable<UndoAction | null>(null);
let _undoTimer: ReturnType<typeof setTimeout> | null = null;

export function pushUndo(action: UndoAction) {
  if (_undoTimer) clearTimeout(_undoTimer);
  undoAction.set(action);
  _undoTimer = setTimeout(() => undoAction.set(null), 5000);
}

export function execUndo() {
  const a = get(undoAction);
  if (!a) return;
  if (_undoTimer) clearTimeout(_undoTimer);
  undoAction.set(null);
  a.fn();
}

export function clearUndo() {
  if (_undoTimer) clearTimeout(_undoTimer);
  undoAction.set(null);
}

// ---- updateUI ----
export function updateUI(updater: (s: UIState) => UIState) {
  uiState.update(updater);
}
