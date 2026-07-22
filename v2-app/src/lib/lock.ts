/**
 * lock.ts — pure biometric-lock decision logic (no side effects, fully testable).
 *
 * This is the state machine behind the app-open Face ID lock. It owns ONLY the
 * question "should the app be showing the lock screen right now?" — it does not
 * touch WebAuthn, localStorage, the DOM, or any store. The store layer
 * (stores/ui-state.ts) holds a LockModel, feeds it real events, and renders the
 * lock overlay when phase === 'locked'. The WebAuthn side effects live in
 * services/biometric.ts.
 *
 * Honest boundary: this is a UX/privacy lock sitting ON TOP of an already-valid
 * Supabase session. It gates the eyeballs, not the data. See
 * BIOMETRIC_LOCK_SPEC_2026-07-22.md.
 */

/** Re-lock threshold: how long the app may sit backgrounded before it re-locks. */
export const BG_RELOCK_MS = 2 * 60 * 1000; // ~2 min

export type LockPhase = 'locked' | 'unlocked';

export interface LockModel {
  /** Is the lock feature turned on for the current user? */
  enabled: boolean;
  /** Current gate state. */
  phase: LockPhase;
  /** Epoch ms when the app was last backgrounded, or null if foreground/never. */
  hiddenAt: number | null;
}

export type LockEvent =
  | { t: 'boot' }                                    // cold start / fresh boot for a user
  | { t: 'unlock-ok' }                               // biometric verify succeeded
  | { t: 'unlock-fail' }                             // verify failed/cancelled — stay locked, allow retry
  | { t: 'hide'; now: number }                       // app went to background
  | { t: 'resume'; now: number; thresholdMs?: number } // app came back to foreground
  | { t: 'set-enabled'; enabled: boolean };          // user toggled the feature in settings

/**
 * Initial model for a user. If the lock is enabled we start LOCKED (cold-start
 * requirement); otherwise the app is immediately usable.
 */
export function initLock(enabled: boolean): LockModel {
  return { enabled, phase: enabled ? 'locked' : 'unlocked', hiddenAt: null };
}

/** A fully-open, feature-off model — used on sign-out so the auth screen is never gated. */
export function unlockedModel(): LockModel {
  return { enabled: false, phase: 'unlocked', hiddenAt: null };
}

/**
 * Pure reducer. Given the current model and an event, returns the next model.
 * Never mutates its input.
 */
export function reduceLock(m: LockModel, e: LockEvent): LockModel {
  switch (e.t) {
    case 'boot':
      // Fresh boot: lock iff the feature is on. Clear any stale background marker.
      return { enabled: m.enabled, phase: m.enabled ? 'locked' : 'unlocked', hiddenAt: null };

    case 'unlock-ok':
      // Successful biometric check opens the gate. hiddenAt is irrelevant now.
      return { ...m, phase: 'unlocked', hiddenAt: null };

    case 'unlock-fail':
      // Failed/cancelled attempt: no state change — the user stays on the lock
      // screen and can retry (or use the password fallback).
      return m;

    case 'hide':
      // Record when we left the foreground, regardless of current phase.
      return { ...m, hiddenAt: e.now };

    case 'resume': {
      const threshold = e.thresholdMs ?? BG_RELOCK_MS;
      // Re-lock only if enabled AND we were away longer than the threshold.
      if (m.enabled && m.hiddenAt !== null && e.now - m.hiddenAt > threshold) {
        return { ...m, phase: 'locked', hiddenAt: null };
      }
      // Short trip away (or feature off): clear the marker, keep current phase.
      return { ...m, hiddenAt: null };
    }

    case 'set-enabled':
      if (e.enabled) {
        // Turning the lock ON mid-session must NOT lock the user out of the app
        // they are actively using. It takes effect on the next boot / long background.
        return { ...m, enabled: true };
      }
      // Turning the lock OFF opens the gate immediately and clears any marker.
      return { enabled: false, phase: 'unlocked', hiddenAt: null };

    default:
      return m;
  }
}
