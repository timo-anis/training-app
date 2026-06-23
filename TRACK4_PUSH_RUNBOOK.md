# Track 4 — Web Push activation runbook (OFF until validated on a real iPhone)

**Status:** scaffolded, not active. The shipped, proven product is the **in-app
unread badge** (coach dashboard + trainee account + in-chat). Push is the §9.4
*enhancement* — it must be validated on a physical iOS device before you promise
it, and it must never become a dependency. If any step below is flaky, do nothing:
the in-app loop already closes the awareness gap.

## What already shipped (works with zero push)
- `public.push_subscriptions` table (own-rows RLS, proven) — the device registry.
- `src/services/push.ts` — guarded client module. With **no `VITE_VAPID_PUBLIC_KEY`**
  set, every function is a safe no-op. It is **not imported on any default path**,
  so the trainee PWA and coach surface bundles are unchanged.
- `supabase/functions/notify-on-message/index.ts` — delivery Edge Function (NOT deployed).

## To turn it on (do this on/with your iPhone)
1. **Generate VAPID keys** (once): `npx web-push generate-vapid-keys`.
2. **Arm the client:** add `VITE_VAPID_PUBLIC_KEY=<public>` to the build env, rebuild/deploy.
3. **Add a SW push handler.** The trainee SW is workbox `generateSW`, which has no
   `push` listener. Either switch to `injectManifest` with a custom SW, or add a
   small extra SW that handles:
   ```js
   self.addEventListener('push', (e) => {
     const d = e.data?.json() ?? {};
     e.waitUntil(self.registration.showNotification(d.title ?? 'New message', {
       body: d.body, data: { url: d.url ?? '/' },
     }));
   });
   self.addEventListener('notificationclick', (e) => {
     e.notification.close();
     e.waitUntil(clients.openWindow(e.notification.data?.url ?? '/'));
   });
   ```
   Keep the coach surface (`coach.html`) decision explicit (§9.3 = no SW today):
   a coach-side push needs a minimal **push-only** SW on `coach.html` — add it only
   if you want coach-side push, and keep it push-only (no offline caching).
4. **Deploy the Edge Function** and set its secrets:
   `SB_URL`, `SB_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
   `supabase functions deploy notify-on-message`.
5. **Wire the trigger as an async Database Webhook** (Dashboard → Database → Webhooks)
   on `INSERT` of `public.messages` → HTTP POST to the function URL.
   **Use a webhook (async), not a synchronous trigger** — delivery must never sit on
   the message-insert path. If the webhook errors, the message still sends.
6. **Enable on the device:** install the PWA to the home screen (iOS only delivers
   push to a standalone PWA), then call `enablePush(userId)` from a user gesture
   (e.g. an "Enable notifications" row you add to the account sheet). `getPushState()`
   tells you why it's unavailable (`not-configured` / `unsupported` / `not-standalone`).
7. **Validate**: send a message from the other side with the app backgrounded;
   confirm the notification lands and tapping it opens the thread. Test re-subscribe,
   revoke (push should stop — the function checks `status='accepted'`), and a denied
   permission (must degrade to in-app badge with no error).

## Guardrails (do not regress)
- Push must stay **off the critical path**: async webhook only; the function swallows
  all errors and returns 200.
- The function checks the link is still `accepted`, so **revoke kills push too**.
- No push code is imported by the default trainee/coach bundles — keep it that way
  until step 2/3 are deliberately taken.
