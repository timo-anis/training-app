/**
 * app.ts — barrel re-export.
 * All components continue to import from '../stores/app' without change.
 *
 * Domain modules:
 *   ui-state.ts     — theme, currentUser, uiState, bootStatus, toast, undo, search/sheet
 *   sync.ts         — syncStatus, scheduleSave, retry/backoff, online flush
 *   workout-state.ts — appState, derived stores, all mutations, boot logic
 */
export * from './ui-state';
export * from './sync';
export * from './workout-state';
