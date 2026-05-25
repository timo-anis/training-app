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
  // Immediately resolve current session
  getSession().then(session => {
    if (session?.user) {
      callback({ status: 'signed_in', user: session.user });
    } else {
      callback({ status: 'signed_out' });
    }
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({ status: 'signed_in', user: session.user });
    } else {
      callback({ status: 'signed_out' });
    }
  });

  return () => subscription.unsubscribe();
}
