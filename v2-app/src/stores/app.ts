import { writable, derived, get } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import type { AppState, UIState, DayOfWeek } from '../types/workout';
import { emptyAppState, DAY_ORDER } from '../types/workout';
import { bootstrapState, saveLocal, saveCloud } from '../services/storage';

// ---- Auth store ----
export const currentUser = writable<User | null>(null);

// ---- App state store ----
export const appState = writable<AppState>(emptyAppState());

// ---- UI state store ----
const today = new Date();
const defaultDay = DAY_ORDER[today.getDay() === 0 ? 6 : today.getDay() - 1];
const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

export const uiState = writable<UIState>({
  week: 1,
  day: defaultDay,
  month: defaultMonth,
  search: '',
  workoutMode: false,
  activeExerciseIndex: 0,
  radarMode: 'day',
  calendarCollapsed: false,
});

// ---- Boot status ----
export type BootStatus = 'idle' | 'loading' | 'ready' | 'error';
export const bootStatus = writable<BootStatus>('idle');

// ---- Derived: current day exercises ----
export const currentDayExercises = derived(
  [appState, uiState],
  ([$state, $ui]) => {
    const day = $state.weeks.find(
      w => w.week === $ui.week && w.day === $ui.day
    );
    return day?.exercises ?? [];
  }
);

// ---- Actions ----

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(userId: string, state: AppState) {
  saveLocal(userId, state);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveCloud(userId, state);
  }, 3000);
}

export async function bootForUser(user: User) {
  bootStatus.set('loading');
  try {
    const state = await bootstrapState(user.id);
    appState.set(state);
    bootStatus.set('ready');
  } catch {
    bootStatus.set('error');
  }
}

export function updateState(updater: (s: AppState) => AppState) {
  appState.update(s => {
    const next = updater(s);
    const user = get(currentUser);
    if (user) scheduleSave(user.id, next);
    return next;
  });
}

export function updateUI(updater: (s: UIState) => UIState) {
  uiState.update(updater);
}
