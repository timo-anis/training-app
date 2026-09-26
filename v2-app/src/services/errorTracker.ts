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

/**
 * Errors raised before a user is signed in (boot, auth screen) cannot be
 * written yet — RLS requires user_id = auth.uid(). Instead of dropping them we
 * hold a small bounded queue and flush it once when a user becomes available.
 * The cap keeps a crash loop on the sign-in screen from growing memory.
 */
export const MAX_PENDING = 10;
interface Pending { c: Captured; url: string; occurredAt: string }
const pending: Pending[] = [];
let flushSubscribed = false;

function ensureFlushOnSignIn(): void {
  if (flushSubscribed) return;
  flushSubscribed = true;
  // Store subscription is kept for the page lifetime (one tiny listener).
  currentUser.subscribe((u) => {
    if (!u || pending.length === 0) return;
    const batch = pending.splice(0);
    for (const p of batch) void writeError(p.c, u.id, p.url, p.occurredAt);
  });
}

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

  const user = get(currentUser);
  if (!user) {
    // No auth yet → RLS would block the write. Queue it (bounded) with the
    // capture-time URL + timestamp so the row stays truthful when flushed.
    // Overflow is NOT marked seen, so the same error can still be recorded if
    // it recurs after sign-in. Known trade-off: an error queued on the sign-in
    // screen is attributed to whoever signs in next (shared-device edge case).
    if (pending.length < MAX_PENDING) {
      seen.add(fingerprint);
      pending.push({ c, url: window.location.pathname, occurredAt: new Date().toISOString() });
    }
    ensureFlushOnSignIn();
    return;
  }
  seen.add(fingerprint);
  await writeError(c, user.id, window.location.pathname);
}

async function writeError(c: Captured, userId: string, url: string, occurredAt?: string): Promise<void> {
  const opaque = c.external && /script error/i.test(c.message);
  const label = opaque
    ? 'Script error (external / cross-origin — no detail)'
    : `${c.name ? c.name + ': ' : ''}${c.message}`;
  const message = `[${c.kind}${c.external ? ' · external' : ''}] ${label}`;
  const stack = [c.source ? `at ${c.source}` : null, c.stack].filter(Boolean).join('\n') || undefined;

  try {
    const { error } = await supabase.from('app_errors').insert({
      user_id:     userId,
      message:     message.slice(0, 500),
      stack:       stack?.slice(0, 2000),
      url,
      app_version: APP_VERSION,
      // Only set for queued (pre-sign-in) errors; otherwise the DB default now() applies.
      ...(occurredAt ? { occurred_at: occurredAt } : {}),
    });
    // supabase-js reports failures in `error` instead of throwing — surface them
    // in devtools so a broken tracker is visible rather than silently empty.
    if (error) console.warn('[errorTracker] could not record error:', error.message);
  } catch (e) {
    // Tracker must never throw — network-level failure, just note it.
    console.warn('[errorTracker] could not record error:', e instanceof Error ? e.message : e);
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
