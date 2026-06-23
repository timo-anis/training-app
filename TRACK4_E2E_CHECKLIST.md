# Track 4 — 2-account E2E checklist (live realtime + UI)

The DB engine is already proven (17-assertion adversarial RLS matrix incl. revoke;
195 unit tests). What only a live run can confirm is **realtime delivery across two
sessions** and the **UI/UX**. Run this once on two profiles/devices.

## Setup (never use Timo's real 69-week trainee data)
- **Coach:** `timo.anis@gmail.com` (or any account) → open `…/coach.html`.
- **Trainee:** a throwaway account, e.g. `timoanis+test6@gmail.com` → open `…/` (the PWA).
  Use **two browser profiles or two devices** — same-origin can hold only one
  Supabase session at a time, so a single profile can't be both at once.
- Coach invites the trainee by email; trainee accepts (account sheet → Coaching → Accept).

## A. Realtime delivery (the core gap)
1. Both open the chat (coach: open trainee → 💬 Chat; trainee: account → "Message your coach").
2. Coach sends "ping". **Expect:** it appears on the trainee within ~1s with NO refresh.
3. Trainee replies. **Expect:** appears on the coach live. Bubbles: own = gold-gradient
   right; peer = left; times + day separator ("Today") render.
4. Send 3 quick messages each way. **Expect:** correct order, no dupes (optimistic echo
   reconciles with the server row), autoscroll to newest.

## B. Unread surfacing (the "see it immediately" fix)
5. Trainee CLOSES the chat and the account sheet (back on the calendar). Coach sends a
   message. **Expect:** within ~1s a **number badge appears on the trainee's account
   icon (top bar)** — no menu needed.
6. Trainee opens the chat → reads. **Expect:** badge clears (top bar + account row).
7. Coach side: from the dashboard (not inside the trainee), trainee sends a message →
   the trainee's **dashboard row shows an unread badge** (on next dashboard load).

## C. Revoke semantics (both sides cut)
8. Trainee revokes the coach (account → Coaching → Revoke → Confirm).
9. **Expect:** coach can no longer open that trainee's chat / sees no thread; trainee's
   "Message your coach" row is gone. Neither can send. (RLS already proves this; confirm UX.)

## D. No regression / byte-identical default
10. A trainee with NO coach: account sheet shows no chat row, no badge ever; calendar/
    workout/add/delete/finish all behave exactly as before.
11. coach.html still has NO service worker (no stale PWA on the coach surface).

## Pass bar
A1–4 live delivery + B5–7 unread + C8–9 revoke + D10–11 no-regression all green.
If realtime is flaky on a network, messages still arrive on next open (on-open refresh) —
that's the designed floor; the in-app badge never depends on push.
