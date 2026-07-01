// notify-on-message — Web Push delivery for Track 4 chat (DEPLOYED — webhook wired).
//
// Per spec §9.4 push is an ENHANCEMENT, never a dependency. This function is the
// optional server piece: triggered by a Database Webhook on INSERT into
// public.messages, it pushes a notification to the OTHER participant of the link.
// It runs as the service role (bypasses RLS) and never touches app_state.
//
// It does NOTHING until you deploy it and wire the webhook (see
// TRACK4_PUSH_RUNBOOK.md). The in-app unread badge works fully without it.
//
// Required function secrets:
//   SB_URL                       (your project URL)
//   SB_SERVICE_ROLE_KEY          (service role key — server-only)
//   VAPID_PUBLIC_KEY             (same key the client subscribes with)
//   VAPID_PRIVATE_KEY            (kept secret, server only)
//   VAPID_SUBJECT               (e.g. mailto:timo.anis@gmail.com)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const admin = createClient(
  Deno.env.get('SB_URL')!,
  Deno.env.get('SB_SERVICE_ROLE_KEY')!,
);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
);

interface MessageRecord {
  id: string;
  link_id: string;
  sender_id: string;
  body: string;
}

Deno.serve(async (req) => {
  // ── Auth guard ────────────────────────────────────────────────────────────
  // Supabase Database Webhooks send `Authorization: Bearer <secret>` when a
  // webhook secret is configured. Without this check ANY caller on the internet
  // could trigger push notifications by hitting the function URL directly.
  // Set WEBHOOK_SECRET in the function's secrets:
  //   supabase secrets set WEBHOOK_SECRET=<your-random-secret>
  // Then configure the same value in the Supabase dashboard webhook settings.
  // If the secret env var is absent (e.g. local dev) the check is skipped.
  // Fail-closed: if WEBHOOK_SECRET is not set the function refuses all requests.
  // This prevents unauthenticated callers from triggering push notifications
  // by hitting the function URL directly. Set it via:
  //   supabase secrets set WEBHOOK_SECRET=<random-secret>
  // and mirror the same value in the Supabase dashboard webhook configuration.
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('notify-on-message: WEBHOOK_SECRET is not configured — refusing request');
    return new Response('Service misconfigured', { status: 503 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${webhookSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const payload = await req.json();
    const msg: MessageRecord | undefined = payload?.record;
    if (!msg?.link_id || !msg?.sender_id) {
      return new Response('ignored', { status: 200 });
    }

    // Resolve the recipient = the accepted link's OTHER participant.
    const { data: link } = await admin
      .from('coach_links')
      .select('coach_id, trainee_id, status')
      .eq('id', msg.link_id)
      .single();
    if (!link || link.status !== 'accepted') {
      return new Response('no active link', { status: 200 });
    }
    const recipient = msg.sender_id === link.coach_id ? link.trainee_id : link.coach_id;
    if (!recipient) return new Response('no recipient', { status: 200 });

    // Fetch the recipient's registered devices.
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', recipient);
    if (!subs?.length) return new Response('no devices', { status: 200 });

    const notification = JSON.stringify({
      title: 'New message',
      body: msg.body.slice(0, 140),
      url: '/',
    });

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            notification,
          );
        } catch (err: any) {
          // Prune dead subscriptions so we never push to them again.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          }
        }
      }),
    );

    return new Response('sent', { status: 200 });
  } catch (_err) {
    // Never surface an error that could affect the message flow.
    return new Response('error', { status: 200 });
  }
});
