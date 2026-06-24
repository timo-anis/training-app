import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase env vars — check .env');
}

// Coach and trainee surfaces share the same origin but need separate sessions
// so both can be open simultaneously in the same browser (two-user testing).
// Using a distinct storageKey keeps their localStorage auth tokens isolated.
const isCoach = typeof window !== 'undefined' && window.location.pathname.includes('coach');
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storageKey: isCoach ? 'sb-coach-auth' : 'sb-trainee-auth',
  },
});

// ---- Password-recovery intent (captured at the earliest point) ----
// With the PKCE flow the reset link returns as `?code=...` (no `type=recovery`
// hash), and the token exchange fires PASSWORD_RECOVERY asynchronously — often
// before the app attaches its own auth listener in onMount. If we miss it we'd
// only see SIGNED_IN and boot the user straight into the app. So we listen here,
// synchronously at client creation, and persist the intent to sessionStorage so
// the app can reliably show the set-new-password screen instead of booting in.
const RECOVERY_KEY = 'timo_pw_recovery';

export function isRecoveryPending(): boolean {
  try { return sessionStorage.getItem(RECOVERY_KEY) === '1'; } catch { return false; }
}

export function clearRecoveryPending(): void {
  try { sessionStorage.removeItem(RECOVERY_KEY); } catch { /* ignore */ }
}

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    try { sessionStorage.setItem(RECOVERY_KEY, '1'); } catch { /* ignore */ }
  }
});
