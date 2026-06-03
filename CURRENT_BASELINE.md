# Current Baseline — Timo Training V2

**Last updated:** 2026-06-03

## Active App: V2

- Source: `v2-app/`
- Deployed: GitHub Pages — https://timo-anis.github.io/training-app/v2/
- MVP1 (`index.html`) is legacy — do not touch

---

## Code health (updated 2026-06-03)

- Boot now merges local vs cloud by timestamp (newer wins) — see `lib/state-merge.ts`; prevents a stale cloud copy overwriting newer local edits.
- Cloud saves are offline-aware with retry/backoff (`stores/app.ts`); flush on `online`.
- WorkoutMode is being split: `WmHeader` + `WmFooter` extracted (2228 -> 2005 lines). Remaining planned increments (own session): set-editor, rest-controls, add-exercise panel, summary overlay.
- a11y: interactive SVG zones + swipe surface have roles/keyboard; build + svelte-check are 0 warnings.
- Tests: 122 (added `storage-merge` + `workout-flow` integration).

---

## Theming (added 2026-06-02)

- All colours are CSS tokens in `v2-app/src/app.css` (see `THEME_SYSTEM.md`).
- Two themes: **dark** (default, base `:root`) and **presentation** (light/high-contrast, `:root[data-theme="presentation"]`).
- Dark theme is pixel-identical to pre-token state (tokens default to the exact prior values).
- Toggle: "Presentation mode" switch in Account sheet. Persisted to localStorage (`timo_training_theme`), applied via `document.documentElement.dataset.theme`; inline boot script in `index.html` prevents flash.
- **Access-gated:** the toggle is visible/usable only for the allow-listed account (`canUsePresentation`, stores/app.ts). Any other signed-in user is forced to dark.
- Presentation accent is a restrained graphite-indigo (not gold) for a premium look on a projector; calendar dates stay legible on every day-type tile.

---

## Confirmed Working Features

### Auth
- Email/password sign in via Supabase
- `onAuthChange` fires only on INITIAL_SESSION and SIGNED_IN — TOKEN_REFRESHED ignored
- Sign out via Account sheet (z-index 200, workout bar hidden when open)

### Boot
- Always lands on today's week + today's day
- `goToToday()` works even when today's week has no workout data
- `goToToday()` sets both week AND day (not just week)

### Calendar — month view
- Initialises to today's month on every boot
- Does NOT auto-follow uiState.week (fixed — was root cause of wrong-month bug)
- Today button appears when user has navigated away from current month
- Day status is data- + day.kind-driven (NO hardcoded weekday rules — removed 2026-06-01):
  - green ✓ = completed/all sets done; amber ◑ = partial; blue dot = workout (marked or logged, not done)
  - amber ○ = recovery (recovery exercises OR kind='recovery'); subdued = rest (kind='rest')
  - unmarked day with no data = neutral/empty (new users see an empty calendar)
  - marked days get a clear coloured cell fill (workout=blue, recovery=amber, rest=grey + dash); today and selected are RINGS (gold / white) so the type colour shows through even on today
- Future days: clickable (for planning), cursor pointer
- Legend: Done / Partial / Workout / Recovery / Rest

### Day-type marking (added 2026-06-01)
- Each day can be marked workout / recovery / rest via a segment toggle under the day heading (setDayKind)
- Stored as optional WorkoutDay.kind; unmarked = neutral. Adding the first exercise auto-sets kind='workout' (unless already marked)
- One-time Wednesday cleanup never prunes a day that has kind set
- Empty-state card shows kind-aware copy + a "＋ Add first exercise" CTA (opens AddExercise) on workout/unmarked days

### Navigation (consolidated 2026-06-01)
- Month calendar is the SINGLE day/week navigator — tap any day to select (sets week+day). The old week strip (Calendar.svelte) was REMOVED — it duplicated the month view.
- Day header has ‹ / › arrows = previous/next day (goToAdjacentDay), crossing week boundaries via date math; clamps at Week 1 Monday.
- "Today" button in the day header (goToToday) appears when not on today.
- New weeks are reached by stepping forward past Sunday or tapping a future date in the month view (no "+ Week" button).
- Day view now sits ABOVE the Statistics toggle.

### Exercise management
- Add exercise: autocomplete + history hint in both normal view and workout mode
- Delete exercise: undo toast (5s) in both views
- Delete set: undo toast (5s)
- Set done toggle: undo toast (5s, lets user recover accidental tap)
- Exercise position badges: all exercises show letter badge (A, B, C…)
  - Supersets grouped by FIRST LETTER of code (A1+A2+A3 = one A group → B comes next)
  - Conditioning shows next available letter after all superset groups
  - Both main view and workout mode use same grouping logic

### Workout mode
- Swipe dots below progress bar
- Progress header: "X/Y sets" (not block count)
- Finish ✓ button always in header — can finish from any block
- Set done: visual flash (iOS) + vibrate 10ms (Android)
- PR detection: gold badge + celebratory vibration when beating previous max weight
- kg/reps committed before block navigation (no data loss on swipe)
- Add exercise: autocomplete + navigates to new block after adding

### Rest timer
- Opens fullscreen by default (focus mode) — dark overlay, 240px ring, 72px number
- Compact mode: tap anywhere on card to expand (no small button)
- Sound ON by default (opt-out)
- Ascending countdown beep last 5 seconds
- Reset button: works correctly (force remount via {#key})
- Warning: amber ring + pulse last 5s
- Auto-start: timer begins on set done using the exercise's configured rest

### Rest timer — manual controls (WorkoutMode)
- `＋` / `－` stepper adjusts duration in 15s steps
- Tapping `＋15s rest` when idle ARMS a duration but does NOT start the countdown — build up 15s → 30s → 45s … first
- Pending (armed) state shows a gold `Start · M:SS` button; countdown begins only on Start
- `－` while pending drops 15s; reaching 0 clears back to idle. `－` while running floors at 15s
- Presets row (1′ / 1:30 / 2′ / 3′) starts the countdown immediately; shown only in idle state

### Sync + topbar
- Cloud sync dot: pulsing amber (saving) → green 2.5s (saved) → idle
- Sync status visible in topbar

### Account sheet
- z-index 200 — above workout bar
- Workout bar hidden when sheet open

### New-user onboarding (improved 2026-06-01)
- Empty-state hero now shows ALWAYS when the current day has no exercises (no longer hidden behind the collapsed day section). Brand-new users (no workouts anywhere) see a welcome hero with a barbell icon, "+ Add first exercise" CTA, and a tip to mark day types.
- OnboardingOverlay walkthrough refreshed to the current model (calendar tap + day-type marking, add exercise, rest-chip editing); removed stale references to the week strip / "+ Week" / hardcoded Wednesday recovery.

### Help / onboarding
- Single help entry: topbar `?` icon opens the "Quick guide" sheet
- Quick guide has an `▶ Ava tutvustus uuesti` button that re-opens the full onboarding walkthrough (`OnboardingOverlay`) via the `requestOnboarding` store
- The old floating "Juhised" chip (position: fixed, bottom-right) was REMOVED — it overlapped page content (e.g. the day card)
- Onboarding still auto-shows once on first login per user (localStorage key `timo_training_v4_onboarded__<userId>`)

---

## Data Model: Schema 4.0

```
WorkoutDay { week, day, date, exercises[], completed?, note? }
Exercise   { id, name, type, code, sets[], rest, note,
             recovery, recoveryDone,
             conditioning, conditioningNote, conditioningDone }
WorkoutSet { kg, reps, done }
```

Superset codes: multi-character supported (A1, A2, B1, B2, B3…).
Grouping logic uses `code[0]` — first letter only — for block letter assignment.
UIState has no `month` field (removed — was dead code).

---

## Test Suite

99 automated tests — `npm test` in `v2-app/`.

| File | Tests |
|------|-------|
| `dates.test.ts` | 20 |
| `migrator.test.ts` | 26 |
| `state-helpers.test.ts` | 42 |
| `store-actions.test.ts` | 11 |

---

## CI Pipeline

Push to main: install → test (99) → TypeScript check → build → deploy to GitHub Pages.

---

## Known Limitations

- iOS vibration: Web Vibration API unsupported on Safari/iOS — no haptic feedback
- No push notifications / reminders
- No export / backup UI
- Undo covers: set delete, exercise delete, set done toggle (not exercise done or all-sets-done)
- GitHub PAT expires 2026-06-25 — reminder set for 2026-06-18

---

## Protected — Do Not Touch Without Explicit Request

- Auth flow and session handling
- Boot flow and bootstrapState
- Cloud sync logic (saveCloud / scheduleSave)
- Storage schema key names and version
- Date/weekday alignment logic
- Superset code pairing and grouping logic
- `immediate=true` flag on `updateState`
- `lib/state-helpers.ts` — pure functions used by both store actions and tests
