/**
 * Production error tracker — logs unhandled errors to Supabase app_errors.
 *
 * Goal: errors must be distinguishable and groupable so it's obvious what is
 * broken. We capture the error name, a normalised message, the source location
 * (file:line:col), the stack, the kind (error vs promise rejection), and whether
 * it came from our own code or an external/cross-origin source. Browser
 * extensions and third-party scripts surface as the opaque "Script error." with
 * no detail — we tag those explicitly so they don't masquerade as app bugs.
 *
 * Fires once per unique fingerprint per session to avoid flooding.
 * No third-party dependency — uses the existing Supabase client.
 */
import { supabase } from './supabase';
import { get } from 'svelte/store';
import { currentUser } from '../stores/app';

// Guarded so a missing define can never throw at boot (typeof on an
// undeclared identifier is safe; Vite replaces the token when defined).
const APP_VERSION: string = (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown');
const seen = new Set<string>();

function sameOriginScript(filename: string | undefined): boolean {
  if (!filename) return false; // empty filename = cross-origin / opaque
  try {
    return new URL(filename, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

interface Captured {
  kind: 'error' | 'rejection';
  name?: string;
  message: string;
  stack?: string;
  source?: string;   // file:line:col
  external: boolean; // extension / third-party / cross-origin
}

async function logError(c: Captured): Promise<void> {
  const fingerprint = `${c.kind}|${c.external ? 'ext' : 'app'}|${c.name ?? ''}|${c.message}`.slice(0, 220);
  if (seen.has(fingerprint)) return;
  seen.add(fingerprint);

  const user = get(currentUser);
  if (!user) return; // no auth → RLS blocks the write

  const opaque = c.external && /script error/i.test(c.message);
  const label = opaque
    ? 'Script error (external / cross-origin — no detail)'
    : `${c.name ? c.name + ': ' : ''}${c.message}`;
  const message = `[${c.kind}${c.external ? ' · external' : ''}] ${label}`;
  const stack = [c.source ? `at ${c.source}` : null, c.stack].filter(Boolean).join('\n') || undefined;

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

/**
 * Log an error that was CAUGHT by a svelte:boundary. Boundary-caught errors
 * never reach window.onerror, so without this hook they are invisible in
 * app_errors — the user sees the fallback card and we see nothing.
 */
export function logCaughtError(error: unknown, context: string): void {
  const err = error instanceof Error ? error : null;
  logError({
    kind: 'error',
    name: err?.name ?? 'BoundaryError',
    message: `boundary(${context}): ${err?.message ?? String(error)}`,
    stack: err?.stack,
    external: false,
  });
}

export function initErrorTracking(): void {
  window.addEventListener('error', (e: ErrorEvent) => {
    const external = !sameOriginScript(e.filename);
    const source = e.filename ? `${e.filename}:${e.lineno ?? 0}:${e.colno ?? 0}` : undefined;
    logError({
      kind: 'error',
      name: e.error?.name,
      message: e.message || 'Unknown error',
      stack: e.error?.stack,
      source,
      external,
    });
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const r = e.reason;
    logError({
      kind: 'rejection',
      name: r instanceof Error ? r.name : undefined,
      message: r instanceof Error ? r.message : String(r ?? 'Unhandled promise rejection'),
      stack: r instanceof Error ? r.stack : undefined,
      external: false,
    });
  });
}
