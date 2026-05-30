import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; user: User };

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // data.session is null if email confirmation is required
  return { user: data.user, needsConfirmation: !data.session };
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href,
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Subscribe to auth state changes. Returns unsubscribe fn. */
export function onAuthChange(callback: (state: AuthState) => void): () => void {
  // Supabase v2 fires INITIAL_SESSION immediately on subscription with the current session.
  // We only handle INITIAL_SESSION and SIGNED_IN — not TOKEN_REFRESHED, USER_UPDATED, etc.
  // This prevents bootForUser from being re-triggered on every token refresh (~60 min),
  // which would reset the user's navigation back to today mid-session.
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      if (session?.user) {
        callback({ status: 'signed_in', user: session.user });
      } else {
        callback({ status: 'signed_out' });
      }
    } else if (event === 'SIGNED_OUT') {
      callback({ status: 'signed_out' });
    }
    // TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY — ignored intentionally
  });

  return () => subscription.unsubscribe();
}
