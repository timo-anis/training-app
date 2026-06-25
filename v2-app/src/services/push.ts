/**
 * push.ts — Web Push capability (Track 4 enhancement, OFF by default).
 *
 * Per spec §9.4 push is an ENHANCEMENT, never a dependency: the in-app unread
 * badge is the shipped, proven awareness loop. This module is the device
 * subscription layer ONLY. It is intentionally NOT imported on any default code
 * path — nothing in the trainee PWA or coach surface calls it until push is
 * deliberately wired and validated on a real iOS device (see TRACK4_PUSH_RUNBOOK.md).
 *
 * Everything degrades gracefully: without a configured VAPID key, or on a
 * browser/context that can't do push, every call is a safe no-op returning a
 * clear reason. Chat value NEVER depends on any of this landing.
 */
import { supabase } from './supabase';

// Set VITE_VAPID_PUBLIC_KEY in the build env to arm push. Absent => disabled.
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';

export type PushReason =
  | 'ok'
  | 'not-configured'    // no VAPID key in the build
  | 'unsupported'       // browser lacks ServiceWorker/PushManager/Notification
  | 'not-standalone'    // iOS requires an installed (home-screen) PWA
  | 'denied'            // user declined the OS permission
  | 'error';

export interface PushState {
  configured: boolean;
  supported: boolean;
  standalone: boolean;
  permission: NotificationPermission | 'unsupported';
}

export function isPushConfigured(): boolean {
  return VAPID_PUBLIC_KEY.length > 0;
}

export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** iOS only delivers Web Push to an installed (standalone) PWA. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false;
  // iOS Safari exposes navigator.standalone for home-screen apps.
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mm || iosStandalone;
}

export function getPushState(): PushState {
  return {
    configured: isPushConfigured(),
    supported: pushSupported(),
    standalone: isStandalone(),
    permission: pushSupported() ? Notification.permission : 'unsupported',
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Subscribe this device and persist it. Returns a reason so the caller can show
 * an honest message. Safe to call speculatively — returns early on any gap.
 */
export async function enablePush(userId: string): Promise<PushReason> {
  if (!isPushConfigured()) return 'not-configured';
  if (!pushSupported()) return 'unsupported';
  if (!isStandalone()) return 'not-standalone';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    const json = sub.toJSON();
    const endpoint = json.endpoint ?? sub.endpoint;
    const p256dh = json.keys?.p256dh;
    const auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) return 'error';

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_id: userId,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent.slice(0, 300),
        },
        { onConflict: 'endpoint' }
      );
    if (error) return 'error';
    return 'ok';
  } catch {
    return 'error';
  }
}

/** Unsubscribe this device and drop its row. Best-effort. */
export async function disablePush(userId: string): Promise<void> {
  try {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const endpoint = sub?.endpoint;
    if (sub) await sub.unsubscribe();
    if (endpoint) {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
    }
  } catch {
    /* best-effort */
  }
}
