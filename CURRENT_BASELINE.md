# Current Baseline — Timo Training V2

**Last updated:** 2026-06-24

## Active App: V2

- Source: `v2-app/`
- Deployed: GitHub Pages — custom domain https://trainingapp.timoanis.com/ (root). Moved from https://timo-anis.github.io/training-app/ on 2026-06-10; github.io project URL 301-redirects to the custom domain. base path /training-app/ -> / (vite.config.ts, PWA scope/start_url, 404.html). DNS: CNAME trainingapp.timoanis.com -> timo-anis.github.io at Zone.ee. public/CNAME holds the domain.

---

## Code health

- **Error tracking enriched 2026-06-11:** errors are now distinguishable + groupable. Real build version stamped (`__APP_VERSION__` = date+git-sha via vite define; was `VITE_APP_VERSION` → always "unknown"). `errorTracker.ts` captures error name, source file:line:col, stack, kind (error vs unhandledrejection), and classifies app vs external/cross-origin (extensions/third-party "Script error." noise tagged so it can't masquerade as an app bug). Verified live in the deployed bundle. ⚠️ Build note: the sandbox `npm run build` returns a STALE phantom bundle (does not reflect source) — verify builds via the deployed `gh-pages` bundle or trust `npm run check` + `npm test`; do not trust local `vite build` output here.

- **Audit fixes 2026-06-11 (P0/P1/P2):** boot no longer fabricates past-day done-states (`applyPastDaysCompleted` removed — days now reflect real logged work; existing data untouched); boot-failure shows a recoverable error screen instead of the sign-in form for an authenticated user; added tests for `streakInfo`/`dayHasActivity`/`copyDayFrom`, and extracted `getDayStatus` into a pure `lib/day-status.ts` with its own tests; `SearchOverlay` typed (no `as any`); CopyDaySheet dialog focusable → svelte-check 0 warnings; week/day↔Date math centralised in `lib/dates` (`weekDayToUTCDate`/`weekDayToLocalDate`/`localDateToWeekDay`) — MonthCalendar/SearchOverlay/BodyMap no longer re-implement it. Suite now 144 tests across 12 files.

- **RPE shipped 2026-06-22 (schema 4.0→4.1):** per-set RIR-based RPE 6–10 (half-steps). `WorkoutSet.rpe` (`''`=unrated); `state-parser` backfills `rpe:''` + upgrades the tag, preserving everything else. `lib/rpe.ts` (pure, unit-tested): Epley e1RM → suggested RPE (clamp 6–10, 0.5-step, `null` when no history/inputs). Honest model: the suggestion shows faint (`≈8`) and is NEVER saved until the user taps a value. `RpeControl.svelte` chip + scale picker (bottom-sheet both modes) + just-in-time education, wired into `SetRow` + `WmSetRow` with kg/reps tap-targets untouched. `updateSetRpe` store action.
- **Trainer Mode — Track 1 shipped 2026-06-22 (foundation + read-only visibility):** a coach can invite a trainee by email, the trainee accepts once (1-tap) inside their own app, and the coach then sees that trainee's REAL logged training, read-only, in the existing calendar + exercise-card views — zero double entry. New tables `coach_links` (ONE accepted coach per trainee via partial unique index), `activity_summary` (cheap dashboard projection, maintained by a guarded DB trigger on `app_state` — keeps the trainee client untouched and can never break a save). RLS: a new SELECT-only policy lets an accepted coach READ a trainee's `app_state`; the coach can NEVER write it (single-writer invariant intact). accept/revoke are SECURITY DEFINER RPCs (accept binds `auth.uid()`+JWT email; revoke is instant). **Proven with an adversarial RLS matrix before any client code** (no-link/pending/revoked deny; accepted reads; revoke cuts within one request; no UPDATE/DELETE by coach; no cross-trainee leak). Coach surface is a SECOND Vite entry `coach.html` (own boot + root, NO service worker; trainee `index.html` PWA untouched) sharing one source of `types`/`services`/components. Reuse via a guarded `readonly` prop on `ExerciseCard`/`SetRow`/`RpeControl` (default false → trainee behavior unchanged). Trainee accept/revoke UI is a self-contained `CoachInviteSection` mounted in the Account sheet (outside all protected flows). Out of scope (Tracks 2–4): coach notes, program authoring, chat. Full schema reproducible in `supabase_rls.sql`.
- **Trainer Mode — Track 2 shipped 2026-06-23 (coach annotations / async feedback):** a coach can leave a note on a whole day OR on a specific exercise; the trainee sees it inline, read-only, where they already look (day note under the day header; exercise note inside the card). ONE primitive `coach_notes` covers both levels — `exercise_id IS NULL` = day-level, else exercise-level keyed by the stable `exercise.id` (set-level deferred, spec 9.1). One-way coach→trainee. RLS: the coach writes ONLY their own rows and ONLY while the link is accepted; the trainee can NEVER write a coach row (no trainee write policy); revoke instantly hides the whole annotation layer from BOTH sides (helper `has_accepted_coach` mirrors `is_accepted_coach`). Anchor uniqueness via `UNIQUE NULLS NOT DISTINCT` doubles as the upsert target. **Proven with a 16-assertion adversarial RLS matrix before any client code** (coach read/write own; spoofed coach_id blocked; insert-for-non-accepted blocked; trainee insert/update/delete all denied; no cross-trainee leak; post-revoke both sides see 0 and coach writes are dead). Client: pure `lib/coachNotes.ts` (anchorKey/indexNotes, unit-tested) + `stores/coachNotes.ts` (optimistic coach mutations) + one reused `CoachNote.svelte` (day + exercise, read/edit) wired into the trainee `MainView`/`ExerciseCard` and the coach `CoachTraineeView` via a new `coachAuthoring` prop (default false → trainee unchanged). 172 tests, check 0/0, clean two-entry build. Full schema in `supabase_rls.sql`.
- **Trainer Mode — Track 3 shipped 2026-06-23 (program authoring — kills Excel planning):** a coach lays out a trainee's FUTURE days using the same add-exercise / copy-a-day tools; the plan appears automatically in the trainee's calendar as a "planned" (dashed-gold) day; the trainee just trains — on first touch the plan materializes into their own log and from then it's theirs. New table `coach_assignments` (coach-owned future days, same `exercises[]` payload; `unique(coach_id,trainee_id,week,day)` doubles as upsert target; integrity CHECK that payload carries an exercises array). RLS reuses `is_accepted_coach`/`has_accepted_coach`: coach full CRUD on OWN rows & only while accepted; trainee SELECT-only via accepted link; NO trainee write policy; revoke hides the whole plan layer from BOTH sides. **§3.4 ownership flip:** untouched day = coach's in `coach_assignments`; started day = trainee's actual in their blob (coach comments only, cannot overwrite). **Materialization writes ONLY the trainee's own blob** (`materializeAssignment`, guarded — never clobbers a day with logged work; seeds prescribed kg/reps but resets done=false/rpe=''; keeps `exercise.id` so coach-note anchors survive the flip) → single-writer invariant intact. **Proven with a 15-assertion adversarial RLS matrix before any client code** (coach CRUD own only; assign-to-non-accepted blocked; spoofed coach_id blocked; trainee insert/update/delete all denied; no cross-trainee leak via a shared coach; post-revoke both sides see 0 + coach writes dead; coach still can't write a trainee `app_state` blob). Client: pure `lib/assignments.ts` (key/index/seed/materialize, +7 tests) + `stores/assignments.ts` (optimistic coach mutations, trainee never writes) + `services/coach.ts` list/save/delete + a "planned" calendar status (MonthCalendar overlay — empty plan map = byte-identical to before) + a trainee planned panel in `MainView` (Start planned workout → materialize) + an isolated coach `AssignmentEditor.svelte` (add-exercise picker, copy-a-day, per-set edit, superset code, reorder; persists only to `coach_assignments`). Protected flows (auth/boot/sync/PWA/`index.html`) untouched. 179 tests, check 0/0, clean two-entry build; gh-pages bundle verified. Out of scope: Track 4 (chat). Full schema in `supabase_rls.sql`.
- **Trainer Mode — Track 4 shipped 2026-06-23 (chat — the relationship layer):** an accepted coach and trainee exchange direct messages inside the app, with realtime delivery and unread badges; the loop never leaves the product. New table `messages` (link-scoped to a `coach_links` row; `sender_id`, `body`, `created_at`, `read_at`). **The ONLY two-way trainer-mode layer** (notes/assignments stay one-way). RLS is the wall: both participants read AND write ONLY their own link's thread; `sender_id` is bound to `auth.uid()` in the INSERT policy (no spoofing); messages are immutable from the client (NO update/delete policy) — read receipts go through a narrow `mark_messages_read` SECURITY DEFINER RPC that only marks messages the caller RECEIVED; revoke instantly kills chat for BOTH sides (`is_link_participant` requires `status='accepted'`). Single-writer intact — `messages` is its own table, never touches `app_state`. **Proven with a 17-assertion adversarial RLS matrix before any client code** (read scoping + no cross-link leak; send-as-self only, spoof/stranger/cross-link/pending/blank-body all denied; read receipts mark only received msgs and reject non-participants; revoke kills read+write+mark-read for both sides without leaking into the other link). Realtime via the `supabase_realtime` publication (RLS applies to realtime too). Client: pure `lib/messages.ts` (sort/merge/replace/unread tally, +10 tests) + `stores/messages.ts` (optimistic two-way send, revert-on-fail, owns the realtime subscription) + `services/coach.ts` list/send/markRead/unreadCounts/subscribe + one reused `ChatView.svelte` opened as an overlay on BOTH surfaces (coach `CoachTraineeView` + trainee `CoachInviteSection`) with unread badges on the coach dashboard, the trainee account row, and in-chat. Chat lives inside the existing optional Coaching section, so the **default no-coach trainee path stays byte-identical**. **Push (spec §9.4) shipped OFF as an enhancement, never a dependency:** the in-app unread badge is the complete, proven awareness loop; push is scaffolded only — `push_subscriptions` table (own-rows RLS, 4-assertion matrix), a fully-guarded `services/push.ts` (no-op without `VITE_VAPID_PUBLIC_KEY`, NOT imported on any default path → not in the bundle), an un-deployed Edge Function `notify-on-message`, and `TRACK4_PUSH_RUNBOOK.md` for device validation. 189 tests, check 0/0, clean two-entry build; advisors clean (only the intentional SECURITY DEFINER + leaked-password WARNs). Full schema in `supabase_rls.sql`.
- **Desktop framing shipped 2026-06-23 (premium wide-browser shell, sha 1ebe320):** on `@media (min-width:900px)` only, both surfaces stop reading as a mobile strip on a void. The centered column becomes a defined app PANEL (lit side borders `--c-edge-b`, soft elevation `--c-shadow`, faint top sheen) floating on an ambient "desk" backdrop (radial navy + subtle accent top-glow). Trainee: `.app-shell` backdrop + `.main` panel (672px) + workout-bar centred under it. Coach: `.coach-root` got the desk bg (was a flat body bg) + matching `.coach-main` panel (720px). FULLY ADDITIVE, all `--c-` tokens (presentation/light mode adapts), NO markup/logic/sticky/rounding changes → mobile/PWA byte-identical. Motivated by coach working in-browser + showing the app to people. SHIPPED 2026-06-24: desktop 2-column coach console (sidebar + main panel; sidebar overflow clip + trainee panel max-width 700px, sha 571bae4+9ab4887).
- **Desktop redesign PR1 shipped (layout scaffold, trainee, `MainView.svelte` only):** on `@media (min-width:900px)` the trainee `.main` becomes a 3-column grid — rail 200px (streak) | center minmax(0,1fr) (welcome + calendar + statistics) | context 360px (the day section / today’s session) — TopBar stays full-width sticky across the top (`grid-area: bar`), max-width 1160px, 18px gaps. Replaces the previous 672px centered panel (1ebe320). **Mobile/PWA byte-identical:** the three region wrappers are `display:contents` below 900px so their children flow directly inside `.main` (now `display:flex; column`), and per-leaf `order` (welcome2/streak3/calendar4/day5/stats6/statsview7) reproduces the exact current single-column sequence. No logic/content/component restyle; no DOM split of the day section (deferred to PR2); workout-bar still App.svelte 672px-centered (PR2 hides it on desktop). check 0/0, 206 tests, clean two-entry build. Reversible in one revert. Next: PR2 (context “Today’s session” panel + hide bottom bar), PR3 (craft pass). See DESKTOP_REDESIGN_SPEC.md.
- **Desktop redesign v2 shipped (2-pane "session-first", trainee; `MainView.svelte` + `App.svelte`):** after live-screenshot feedback the 3-col PR1 scaffold was reworked into the approved direction — at `@media (min-width:900px)`: full-width sticky TopBar, then a **streak status strip** (the existing StreakStrip placed full-width, `grid-area: strip`), then two panes — **Planner** left (`minmax(0,2fr)`: calendar + Statistics) and **today’s Session** right (`minmax(0,3fr)`, the hero): a **Start/Resume/Stop CTA at the top of the session pane** + the day section. The bottom `.workout-bar` is now `display:none` on desktop (its control moved into the session pane; MainView mirrors `openWorkoutMode`/`exitWorkout` + a ported elapsed clock). Fixes the screenshot issues: no hierarchy, streak-as-column void, dominant floor CTA, ragged alignment. **Mobile/PWA byte-identical** (region wrappers `display:contents` + per-leaf `order`; CTA `display:none` <900px so the bottom bar still owns mobile). check 0/0, 206 tests, clean two-entry build. PR3 craft pass (B) DONE — see next bullet. See DESKTOP_REDESIGN_SPEC.md.
- **Desktop redesign PR3 craft pass (B) shipped 2026-06-24 (`041c447`):** pure CSS craft pass. (a) Calendar tonal-gold structure: today = solid gold ring, partial = gold ring + hint fill, has-data/recovery = gold outline, rest/weekend = dim grey, planned = dashed-gold. (b) Typography: `font-variant-numeric: tabular-nums` app-wide + desktop `.day-label` 23px refinement. (c) Backdrop: refined desktop vignette + faint brand glow ≥900px. **Partially reverted 2026-06-24 (user preference):** done days restored to green disc (`--h-4fc08d`, commits `81676b0`+`419cd1a`); StreakStrip reverted to emoji 🔥 + circular dots + green 'secured' text. Typography, backdrop, and partial/recovery/rest/planned calendar colours remain from PR3. check 0/0, 206 tests, clean two-entry build.
- **Coach console 2-column desktop layout shipped 2026-06-24 (`571bae4` + `9ab4887`):** at `@media (min-width:900px)` the coach SPA (`CoachApp.svelte`) switches from sequential mobile flow to a grid (`300px 1fr`): sidebar (trainee list + CoachDashboard) on the left, main panel (CoachTraineeView or empty state) on the right. `mobile-hidden`/`desktop-hidden` CSS classes control the sequential vs side-by-side switch without duplicating markup; the "Back to trainees" button is `desktop-hidden`. Max-width 1160px, centered. Bug fixes same day: sidebar `overflow: hidden auto` (prevents horizontal clip/scroll); `CoachTraineeView` gets `max-width: 700px; margin: 0 auto` at ≥900px so the calendar does not stretch to the full panel width. check 0/0, 207 tests, clean two-entry build.
- Boot merges local vs cloud by timestamp (newer wins) — `lib/state-merge.ts`
- Cloud saves are offline-aware with retry/backoff (`stores/sync.ts`); flush on `online`
- WorkoutMode split (2228 → 1305 lines, -41%): extracted `WmHeader`, `WmFooter`, `WmRestControls`, `WmAddExercise`, `WmSummary`, `WmSetRow` as presentational children
- Store split (2026-06-04): `stores/app.ts` barrel re-exports `ui-state.ts`, `sync.ts`, `workout-state.ts`
- Tests: 189 across 18 files (logic/state/date + component) — all green
- a11y: interactive SVG zones + swipe surface have roles/keyboard; build + svelte-check 0 warnings

---

## Theming

- All colours are CSS tokens in `v2-app/src/app.css` (see `THEME_SYSTEM.md`)
- Two themes: **dark** (default) and **presentation** (light/high-contrast)
- Toggle: "Presentation mode" in Account sheet — access-gated (`canUsePresentation`)
- Persisted to localStorage (`timo_training_theme`); inline boot script prevents flash

---

## Confirmed Working Features

### Auth
- Email/password sign in via Supabase
- `onAuthChange` fires only on INITIAL_SESSION and SIGNED_IN — TOKEN_REFRESHED ignored
- Sign out via Account sheet (z-index 200, workout bar hidden when open)
- Signup needing confirmation -> dedicated 'Confirm your email' screen (AuthView mode 'confirm'); no premature sign-in form. 'Email not confirmed' on sign-in routes there too. Resend via `resendConfirmation()` (auth.ts)
- `public/404.html`: GitHub Pages SPA + auth-redirect safety net — bounces unknown paths to / (root) preserving query + hash (auth tokens)
- Password reset: clicking the email link lands on a dedicated 'Set a new password' screen (AuthView mode 'set-password', fields 'Create a new password' + 'Confirm new password'), then drops straight into the app (no second email). Robust against the PKCE flow: the reset link returns as `?code=` and PASSWORD_RECOVERY can fire before the app subscribes, so a listener attached at client creation (supabase.ts) persists the intent to sessionStorage (`isRecoveryPending`/`clearRecoveryPending`); App.svelte seeds recoveryMode from that flag, re-checks it in the signed_in guard, defers boot until the password is set, clears the flag on success/sign-out and strips the code from the URL. auth.ts also emits a 'recovery' AuthState + `updatePassword()`. Added 2026-06-10.

### Open config (dashboard — not in code)
- Post-confirmation redirect dropped the `/training-app/` path and landed on bare host root (no Pages site -> 404), even with correct Site URL. FIXED in code 2026-06-10: `signUpWithEmail` + `resendConfirmation` now pass explicit `emailRedirectTo = origin + import.meta.env.BASE_URL` (auth.ts), so confirmations land on the real app URL.
- ROOT CAUSE of post-confirmation 404 (found 2026-06-10): Supabase Site URL + redirect were set to `https://mullemeeldibtrenniteha2026.github.io/training-app/` — a host with NO Pages site. App actually lives at `https://timo-anis.github.io/training-app/`. Fix = set Supabase Site URL + Redirect URLs to `https://timo-anis.github.io/training-app/` (+ `/**`). Verified via fetch: timo-anis host serves the app, mullemeeldibtrenniteha2026 returns 'no site here'. `public/404.html` stays as a net for genuine sub-path 404s on the real host.
- Password policy relaxed to 'Letters and digits' (was requiring a symbol -> rejected password-manager suggestions; architect feedback) 2026-06-10. Min length 8. AuthView pw-hint updated to match.

### Boot
- Always lands on today's week + today's day
- `goToToday()` works even when today's week has no workout data

### Calendar — month view
- Circle-based design (Oura-style) — no coloured cell backgrounds
  - Done: green filled circle | Partial: gold ring + hint fill | Recovery: gold outline | Rest/Weekend: dim dashed grey | Today: solid gold ring (overlays status disc) | Planned: dashed gold ring
- Day status is data- + `day.kind`-driven (no hardcoded weekday rules)
- Presentation mode: all states + legend override for white background

### Day-type marking
- Segment toggle: workout / recovery / rest (stored as `WorkoutDay.kind`)
- Adding first exercise auto-sets `kind='workout'` unless already marked

### Navigation
- Month calendar is the SINGLE navigator — tap any day sets week+day
- Day header ‹ / › arrows = previous/next day (crosses week boundaries via date math)
- "Today" button appears when not on today

### Exercise management
- Add exercise: autocomplete + history hint; **inherits rest time from last use of same name**
- Delete exercise/set: undo toast (5s)
- Set done toggle: undo toast (5s)
- Exercise position badges: A, B, C… (supersets grouped by first letter of code)

### Exercise note (always visible) — added 2026-06-22
- Note row is **always rendered** under each exercise in both ExerciseCard and WorkoutMode (previously shown only when filled)
- Empty: tappable dashed "+ Note" ghost row; Filled: tap-to-edit inline textarea, commits on blur
- Reuses `updateExerciseMeta(week, day, exId, { note })` — no schema change
- WorkoutMode: `localNote` map + `noteEditingId` mirror the existing `localCondNote`/`editingNameId` pattern; committed on block navigation

### Edit sheet (ExerciseCard)
- Opens as bottom sheet on pencil icon tap
- Fields: Name, Type (Weighted/Superset/No weights), Group Code (conditional), Rest, Note
- **Move up/down reorder** — present in ExerciseCard (`moveExercise` up/down); reorders within the day
- CSS: `height: min(88vh, 600px)` — `vh` used (not `dvh`) for iOS Safari compatibility
- Flex layout: handle → scrollable body → Cancel/Save (flex-shrink: 0, always visible)

### Copy Day From (added 2026-06-09)
- New `CopyDaySheet.svelte` — bottom sheet showing all past days with exercises (newest first, max 30)
- Each row: day label + exercise name preview + count badge
- Select row → confirm button "Copy X exercises" → calls `copyDayFrom()` → appends to target day
- Accessible via "Copy from another day →" button on empty/non-empty day views
- `copyDayFrom(srcWeek, srcDay, tgtWeek, tgtDay)` in `workout-state.ts`:
  - Appends cloned exercises from source (does NOT replace)
  - Resets all done states
  - Guarantees min 1 set per exercise
- `copyPreviousDay` also updated: guarantees min 1 set per exercise

### Workout mode
- Swipe dots below progress bar
- Progress header: "X/Y sets"
- Finish ✓ button always in header
- Finish summary (WmSummary) is a premium recap: animated count-up (duration/sets/volume), streak pill (≥2 consecutive weeks with activity), volume vs last session (% + kg delta), personal-record rows (old→new kg, gold sweep), best set, and a next-session hook. All derived read-only in WorkoutMode (dayHasActivity/dayVolume + reactive blocks); respects prefers-reduced-motion; tap skips to final state. Added 2026-06-10.
- Set done: visual flash + vibrate 10ms (Android only — iOS unsupported)
- PR detection: gold badge + celebratory vibration

### Rest timer
- Fullscreen by default; compact mode available
- Sound ON by default; ascending beep last 5s
- Auto-start on set done using exercise's configured rest
- `+`/`-` stepper (15s steps); presets 1′/1:30/2′/3′

### Onboarding / Help
- **Auto-shows only for new users (no training data)** — existing users skip auto-show
- Re-openable via topbar `?` → Quick guide → "Ava tutvustus uuesti"
- Walkthrough: calendar → day types → add exercise → rest chip
- Quick guide has 8 cards in alphabetical order: Calendar, Coach chat, Rest timer, RPE, Session note, Statistics, Training, Workout mode (2026-06-24)

### Records page
- Trophy button (🏆) next to Statistics opens a bottom sheet: all-time personal bests per exercise (best kg × reps from all done weighted sets), grouped and sorted alphabetically. Pure reactive computation from `$appState` — no schema change. `RecordsSheet.svelte` (2026-06-24)

### Exercise / Workout bugs fixed
- **Lone superset-coded exercise**: a single exercise with `type:'superset'` and a code (e.g. A) but no partner no longer shows a "Superset A" badge. Fix at source (`buildWorkoutBlocks`: `isSuperset = group.length > 1`) + `ExerciseCard` gated on `supersetSize > 1` prop. Also wired in `CoachTraineeView` (2026-06-24)

### Sync + topbar
- Cloud sync dot: pulsing amber (saving) → green 2.5s → idle

### workout-bar z-index
- `position: relative; z-index: 1` — explicitly below edit sheet backdrop (z-index: 94) and sheet (z-index: 95)
- Fixes iOS Safari compositing issue where `backdrop-filter` on workout-bar appeared above edit sheet

---

## Data Model: Schema 4.1

```
WorkoutDay { week, day, date, exercises[], completed?, note?, kind? }
Exercise   { id, name, type, code, sets[], rest, note,
             recovery, recoveryDone, conditioning, conditioningNote, conditioningDone }
WorkoutSet { kg, reps, done, rpe }   // rpe: RIR-based RPE 6–10, '' = unrated (4.1)
```

---

## Test Suite

207 automated tests across 17 files — run `npm test` in `v2-app/`.
(Per-file counts intentionally not listed here to avoid drift; the runner is the source of truth.)

---

## CI Pipeline

Push to main: install → test (207) → TypeScript check → build → deploy to GitHub Pages.

---

## Known Limitations / Pending

- iOS vibration: Web Vibration API unsupported on Safari/iOS
- No push notifications / reminders
- No export / backup UI (data backup scheduled via automated task — Sundays)
- Undo covers: set delete, exercise delete, set done toggle (not exercise done or all-sets-done)
- Recovery helpers (`isRecoveryPending`/`clearRecoveryPending`) are integration-level (sessionStorage in supabase.ts, env-dependent) — exercised via the live flow, not unit-tested

---

## Protected — Do Not Touch Without Explicit Request

- Auth flow and session handling
- Boot flow and bootstrapState
- Cloud sync logic (saveCloud / scheduleSave)
- Storage schema key names and version
- Date/weekday alignment logic
- Superset code pairing and grouping logic
- `immediate=true` flag on `updateState`
- `lib/state-helpers.ts`
