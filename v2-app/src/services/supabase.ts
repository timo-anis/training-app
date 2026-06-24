import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Missing Supabase env vars — check .env');
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-tab auth storage adapter
//
// Problem: all trainee tabs in the same browser share one localStorage key
// ("sb-trainee-auth").  When tab A refreshes its token it writes a new JWT
// to that key.  The browser fires a `storage` event on tab B; Supabase picks
// it up, sees the key changed, and fires SIGNED_IN — but now with the OTHER
// user.  Tab B's app boots as the wrong user.
//
// Fix: each tab gets its own tab ID (stored in sessionStorage, survives page
// reloads but not tab close/reopen).  Tokens are stored in localStorage under
// a tab-unique key ("sb-trainee-auth_<tabId>").  Because the actual key in
// localStorage differs from what Supabase's own storage-event listener watches
// for, cross-tab auth events stop firing entirely.  No token refresh in tab A
// can contaminate tab B.
//
// Trade-off: if the user closes the tab and reopens it (or if iOS evicts the
// PWA from memory), the tab ID in sessionStorage is gone → the user must
// log in once.  For daily PWA use this is negligible; session loss from
// memory pressure happens at most monthly.
// ─────────────────────────────────────────────────────────────────────────────
function makePerTabStorage(storageKey: string): Storage {
  if (typeof window === 'undefined') return localStorage;

  // Each browser tab gets a stable, unique ID.  It persists across page
  // reloads (same session) but is gone when the tab is closed or the OS
  // evicts the PWA session.
  const TAB_ID_KEY = `_auth_tab_${storageKey}`;
  let tabId: string;
  try {
    tabId = sessionStorage.getItem(TAB_ID_KEY) ?? '';
    if (!tabId) {
      tabId = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(TAB_ID_KEY, tabId);
    }
  } catch {
    // sessionStorage blocked (private browsing with strict settings) → fall
    // back to a runtime-only ID; cross-tab isolation still works, tokens just
    // won't survive a hard reload in that edge case.
    tabId = Math.random().toString(36).slice(2, 10);
  }

  const prefix = (key: string) => `${key}_${tabId}`;

  return {
    // Implement the Storage interface Supabase expects.
    get length() { return localStorage.length; },
    key: (index: number) => localStorage.key(index),
    getItem: (key: string) => localStorage.getItem(prefix(key)),
    setItem: (key: string, value: string) => localStorage.setItem(prefix(key), value),
    removeItem: (key: string) => localStorage.removeItem(prefix(key)),
    clear: () => localStorage.clear(),
  } as Storage;
}

// Coach and trainee surfaces share the same origin but need separate sessions
// so both can be open simultaneously in the same browser (two-user testing).
// The coach uses a fixed key (one coach at a time is fine); the trainee uses
// a per-tab adapter so multiple trainee tabs never contaminate each other.
const isCoach = typeof window !== 'undefined' && window.location.pathname.includes('coach');
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storageKey: isCoach ? 'sb-coach-auth' : 'sb-trainee-auth',
    ...(isCoach ? {} : { storage: makePerTabStorage('sb-trainee-auth') }),
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Password-recovery intent (captured at the earliest point)
//
// With the PKCE flow the reset link returns as `?code=...` (no `type=recovery`
// hash), and the token exchange fires PASSWORD_RECOVERY asynchronously — often
// before the app attaches its own auth listener in onMount.  If we miss it we'd
// only see SIGNED_IN and boot the user straight into the app.  So we listen
// here, synchronously at client creation, and persist the intent to
// sessionStorage so the app can reliably show the set-new-password screen
// instead of booting in.
// ─────────────────────────────────────────────────────────────────────────────
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
