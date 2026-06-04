/**
 * Production error tracker — logs unhandled errors to Supabase app_errors table.
 * Fires once per unique message per session to avoid flooding.
 * No third-party dependency — uses the existing Supabase client.
 */
import { supabase } from './supabase';
import { get } from 'svelte/store';
import { currentUser } from '../stores/app';

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'unknown';
const seen = new Set<string>();

async function logError(message: string, stack?: string): Promise<void> {
  const key = `${message}::${stack?.slice(0, 100) ?? ''}`;
  if (seen.has(key)) return;
  seen.add(key);

  const user = get(currentUser);
  if (!user) return; // no auth → can't write (RLS)

  try {
    await supabase.from('app_errors').insert({
      user_id:     user.id,
      message:     message.slice(0, 500),
      stack:       stack?.slice(0, 2000),
      url:         window.location.pathname,
      app_version: APP_VERSION,
    });
  } catch {
    // Tracker must never throw — silent fail
  }
}

export function initErrorTracking(): void {
  window.addEventListener('error', (e: ErrorEvent) => {
    logError(e.message ?? 'Unknown error', e.error?.stack);
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const msg = e.reason instanceof Error
      ? e.reason.message
      : String(e.reason ?? 'Unhandled promise rejection');
    const stack = e.reason instanceof Error ? e.reason.stack : undefined;
    logError(msg, stack);
  });
}
