# Current Baseline — Timo Training V2

**Last updated:** 2026-06-10

## Active App: V2

- Source: `v2-app/`
- Deployed: GitHub Pages — custom domain https://trainingapp.timoanis.com/ (root). Moved from https://timo-anis.github.io/training-app/ on 2026-06-10; github.io project URL 301-redirects to the custom domain. base path /training-app/ -> / (vite.config.ts, PWA scope/start_url, 404.html). DNS: CNAME trainingapp.timoanis.com -> timo-anis.github.io at Zone.ee. public/CNAME holds the domain.

---

## Code health

- **Audit fixes 2026-06-11 (P0/P1/P2):** boot no longer fabricates past-day done-states (`applyPastDaysCompleted` removed — days now reflect real logged work; existing data untouched); boot-failure shows a recoverable error screen instead of the sign-in form for an authenticated user; added tests for `streakInfo`/`dayHasActivity`/`copyDayFrom` (133 green); `SearchOverlay` typed (no `as any`); CopyDaySheet dialog focusable → svelte-check 0 warnings.

- Boot merges local vs cloud by timestamp (newer wins) — `lib/state-merge.ts`
- Cloud saves are offline-aware with retry/backoff (`stores/sync.ts`); flush on `online`
- WorkoutMode split (2228 → 1305 lines, -41%): extracted `WmHeader`, `WmFooter`, `WmRestControls`, `WmAddExercise`, `WmSummary`, `WmSetRow` as presentational children
- Store split (2026-06-04): `stores/app.ts` barrel re-exports `ui-state.ts`, `sync.ts`, `workout-state.ts`
- Tests: 133 (122 store/logic + 11 WmSetRow component) — all green
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
  - Done: green filled circle | Partial: white outline | Recovery: amber | Rest: dashed | Today: gold ring
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

### Sync + topbar
- Cloud sync dot: pulsing amber (saving) → green 2.5s → idle

### workout-bar z-index
- `position: relative; z-index: 1` — explicitly below edit sheet backdrop (z-index: 94) and sheet (z-index: 95)
- Fixes iOS Safari compositing issue where `backdrop-filter` on workout-bar appeared above edit sheet

---

## Data Model: Schema 4.0

```
WorkoutDay { week, day, date, exercises[], completed?, note?, kind? }
Exercise   { id, name, type, code, sets[], rest, note,
             recovery, recoveryDone, conditioning, conditioningNote, conditioningDone }
WorkoutSet { kg, reps, done }
```

---

## Test Suite

133 automated tests across 11 files — run `npm test` in `v2-app/`.
(Per-file counts intentionally not listed here to avoid drift; the runner is the source of truth.)

---

## CI Pipeline

Push to main: install → test (133) → TypeScript check → build → deploy to GitHub Pages.

---

## Known Limitations / Pending

- **Onboarding copy stale** — tip mentions "blue/amber/violet fill" but calendar is now circle-based
- iOS vibration: Web Vibration API unsupported on Safari/iOS
- No push notifications / reminders
- No export / backup UI (data backup scheduled via automated task — Sundays)
- Undo covers: set delete, exercise delete, set done toggle (not exercise done or all-sets-done)
- **GitHub PAT expires 2026-06-25** — renewal reminder set for 2026-06-18
- No test coverage for: `copyDayFrom`, rest time inheritance in `addExercise`

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
- New-user welcome card now offers 3 starter templates (Full Body / Upper-Lower / Push-Pull-Legs): tap one -> scaffolds today's day via addExercise (1 empty set each), then fill weights. "Start blank" + "How it works" kept as secondary. Removes blank-slate friction. MainView.svelte, added 2026-06-10.
- Persistent streak/consistency strip (`StreakStrip.svelte`) above the calendar in MainView: gold flame + "{n}-week streak", a "this week secured / at risk / start a streak" status line, and a 6-dot recent-weeks row. Three states (active / risk / dormant). Streak logic extracted to shared `streakInfo` derived store + `dayHasActivity` helper in `workout-state.ts` (single source of truth; WorkoutMode finish screen now consumes the shared helper). Pure read-only; no schema/date/superset changes. Added 2026-06-10.
