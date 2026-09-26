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
 * Rule: boot when the user changes, or when the app is not already booted and
 * healthy for that same user. A failed/idle/loading boot still re-boots, so an
 * error screen can recover on the next SIGNED_IN.
 */
import type { BootStatus } from '../stores/ui-state';

export function shouldBootOnSignIn(
  currentUserId: string | null | undefined,
  bootStatus: BootStatus,
  signedInUserId: string,
): boolean {
  if (!currentUserId || currentUserId !== signedInUserId) return true;
  return bootStatus !== 'ready';
}
