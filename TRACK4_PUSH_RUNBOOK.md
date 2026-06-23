# Track 4 — Web Push activation runbook

**Status:** client side is **fully wired and inert by default**. Push turns on the
moment you (1) arm the public VAPID key in the build, (2) deploy the function +
set its secrets, and (3) add the async webhook — then validate on your iPhone.
The shipped, proven product is the **in-app unread badge** (top-level on both
sides). Push is the §9.4 *enhancement* — never a dependency.

## Already shipped (safe, no behavior change until armed)
- `public/push-sw.js` — push + notificationclick handler, `importScripts`'d into
  the workbox SW (verified in `v2-dist/sw.js`). Inert until a subscription + a
  server push exist.
- Account sheet "Enable notifications" row — **hidden** unless push is configured
  (`getPushState().configured && supported`), so the current build is unchanged.
- `services/push.ts` (no-op without the key), `push_subscriptions` table (own-rows
  RLS, proven), `supabase/functions/notify-on-message/index.ts` (not deployed).

## Your VAPID keys (generated 2026-06-23)
- **Public** (safe to commit / ship in the client):
  `BODLfm3GhYxFxIZ5Ju8Wwy7A2yM4zwkoLu0rOhgf_drvqaO4gW4omgXx1Ci-GPFOgmVpTDGMN24WjSh_mZn0IOE`
- **Private** (SECRET — set as a function secret only, never commit): Timo has it
  from chat. If lost, regenerate the pair with `npx web-push generate-vapid-keys`.

## Turn it on (do this with your iPhone)
1. **Arm the client:** add `VITE_VAPID_PUBLIC_KEY=BODLfm3GhYxFxIZ5Ju8Wwy7A2yM4zwkoLu0rOhgf_drvqaO4gW4omgXx1Ci-GPFOgmVpTDGMN24WjSh_mZn0IOE`
   to the build env (GitHub Actions build step / `.env`), then redeploy. The
   account-sheet row appears once this is set.
2. **Deploy the function** (no JWT gate — it's called server-internally by the webhook):
   `supabase functions deploy notify-on-message --no-verify-jwt`
3. **Set the function secrets:**
   `supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:timo.anis@gmail.com SB_URL=https://krpbqzhttgelrbhkohct.supabase.co SB_SERVICE_ROLE_KEY=…`
   (service role key from Dashboard → Project Settings → API; keep server-only.)
4. **Wire the ASYNC webhook** (Dashboard → Database → Webhooks): event = INSERT on
   `public.messages`, type = Supabase Edge Function → `notify-on-message`.
   **Async only** — delivery must never sit on the message-insert path; if it
   errors, the message still sends (the function also swallows all errors → 200).
5. **Install + enable on device:** add the PWA to the iOS Home Screen (iOS only
   delivers push to a standalone PWA), open the account sheet → "Enable
   notifications", grant permission. `getPushState()` explains any block
   (`not-configured` / `unsupported` / `not-standalone`).
6. **Validate:** message from the other side with the app backgrounded → confirm
   the notification lands and tapping it opens the app. Test: re-subscribe,
   permission denied (must degrade to in-app badge, no error), and **revoke**
   (push stops — the function checks the link is still `accepted`).

## Guardrails (don't regress)
- Push stays OFF the critical path (async webhook; function returns 200 on any error).
- Revoke kills push too (function checks `status='accepted'`).
- Coach-side push would need a push-only SW on `coach.html` (§9.3 = no SW today) —
  decide separately; trainee-side is the priority.
- Optional hardening: have the function check a shared-secret header from the webhook.
