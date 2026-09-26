/**
 * auth-boot.ts — decide whether a SIGNED_IN auth event must (re)boot the app.
 *
 * supabase-js re-emits SIGNED_IN every time the page goes hidden → visible
 * (GoTrueClient._onVisibilityChanged → _recoverAndRefresh). On a phone that is
 * every app switch or screen lock mid-workout. Treating each of those as a
 * fresh sign-in re-ran bootForUser, which reloaded state and reset the viewed
 * week/day (to the nav snapshot or today) — the workout overlay then showed a
 * different, often empty, day ("0/0 SETS · 1/0" blank screen).
 *
 * Rule: skip the re-boot ONLY for the same, already-booted user while a
 * workout session is running — that is where a re-boot does real damage
 * (BootOverlay unmounts WorkoutMode: uncommitted set inputs, superset position
 * and the pinned view are lost). Outside a workout the resume re-boot is kept
 * on purpose: it is the app's only pull of newer cloud data (edits from another
 * device) and it moves the view to today after a day rollover. A failed/idle/
 * loading boot always re-boots, so an error screen can recover.
 */
import type { BootStatus } from '../stores/ui-state';

export function shouldBootOnSignIn(
  currentUserId: string | null | undefined,
  bootStatus: BootStatus,
  signedInUserId: string,
  workoutActive: boolean,
): boolean {
  if (!currentUserId || currentUserId !== signedInUserId) return true;
  if (bootStatus !== 'ready') return true;
  return !workoutActive;
}

/**
 * A forgotten session (never stopped) must not disable the resume refresh
 * forever: only a session started within this window blocks the re-boot.
 */
export const MAX_PROTECTED_SESSION_MS = 4 * 60 * 60 * 1000;

export function sessionBlocksReboot(
  workoutActive: boolean,
  workoutStartTime: number | null,
  now: number,
): boolean {
  if (!workoutActive || workoutStartTime === null) return false;
  return now - workoutStartTime < MAX_PROTECTED_SESSION_MS;
}
