# Current Baseline — Timo Training V2

**Last updated:** 2026-05-30

## Active App: V2

V2 is the production app. MVP1 (index.html) is legacy — do not modify.

- Source: `v2-app/`
- Deployed: GitHub Pages from `v2-dist/`
- Live: https://timo-anis.github.io/training-app/v2/

---

## Confirmed Working Features

### Auth
- Email/password sign in via Supabase
- Auth-first boot — no content shown before sign in
- Sign out via Account sheet
- `onAuthChange` fires only on INITIAL_SESSION and SIGNED_IN — TOKEN_REFRESHED ignored (no spurious re-boots)

### Boot flow
- BootOverlay shown during Supabase session check + data load
- Cloud state loaded first; local state used as fallback
- Always lands on today's week + today's day on boot
- `goToToday()` works even when today's week has no workout data

### Calendar
- Month calendar — initialises to today's month on every boot
- Month calendar has Today button when user has navigated away from current month
- Month calendar follows week-strip navigation but does NOT auto-jump when uiState.week changes
- Week strip with day picker — `goToToday()` sets both week AND day (not just week)
- Future days are clickable (intentional — allows planning ahead)
- Sync dot in topbar (saving pulsing amber → saved green 2.5s → idle)

### Exercise management
- Add exercise (search + select or free-text)
- Delete exercise
- Edit exercise name, type (single/superset/conditioning/recovery)
- Reorder exercises (up/down arrows)
- Add set / delete set with 5-second undo toast

### Workout mode
- Full-screen overlay, block-by-block navigation
- Swipe left/right — swipe indicator dots below progress bar
- Progress header shows "X/Y sets" (not block count)
- Finish ✓ button always visible in header — can finish from any block
- Set done toggle — immediate cloud save
- Visual flash on set done button (iOS haptic substitute)
- Haptic vibrate(10ms) on set done (Android)
- PR detection — gold badge + celebratory vibration when beating previous max weight
- Wake Lock — screen stays on during workout
- kg ±2.5 and reps ±1 adjustment buttons
- Progress from previous session shown inline
- Progressive overload hint — "→ Try X+2.5kg?" when same weight as last session
- kg/reps committed to store before block navigation (no data loss on swipe)
- Inline exercise rename
- Add exercise within workout mode
- Session note — per-day free-text note
- Workout summary overlay on finish (duration, sets done, volume)
- Conditioning block: free-text note + previous session shown
- Recovery block: single done toggle

### Rest timer
- Default: opens fullscreen (focus mode) — dark overlay, 240px SVG ring, 72px countdown
- Minimize button collapses to compact inline view (ring 60px + Skip/Reset)
- Expand button restores fullscreen from compact
- Sound ON by default (opt-out, not opt-in)
- Ascending countdown beep last 5 seconds (800Hz→1200Hz)
- AudioContext singleton (iOS suspend-safe)
- Vibration countdown last 5 seconds (Android only — iOS does not support vibration API)
- Pulse animation on number during last 5 seconds
- Warning state: amber ring + amber number
- Rest presets: 1' / 1:30 / 2' / 2:30 / 3' shown when no timer running
- Persists through overlay close/reopen

### Account sheet
- z-index 200 — renders above workout bar
- Workout bar hidden when account sheet is open
- Change password (email reset)
- Clear all training data (confirmation tap)
- Sign out

### Data persistence
- localStorage (schema 4.0) — always written first
- Supabase cloud sync — 3s debounced, immediate for critical state
- Sync status store exposed to topbar dot indicator

### Stats (inline, collapsible)
- Body map (muscle group visualization)
- Summary chips, volume sparkline, weekly breakdown, plateau detection
- Per-exercise progression chart

### Design
- Dark Glass theme
- Gold: #c49230 primary, #d4a038 title
- Minimal Crown header with gold accent line

---

## Data Model: Schema 4.0

```
WorkoutDay { week, day, date, exercises[], completed?, note? }
Exercise   { id, name, type, code, sets[], rest, note,
             recovery, recoveryDone,
             conditioning, conditioningNote, conditioningDone }
WorkoutSet { kg, reps, done }
```

UIState no longer has a `month` field (removed — was dead code, MonthCalendar derives its own view state).

---

## Test Suite

88 automated tests — run with `npm test` in `v2-app/`.

| File | Tests | Coverage |
|------|-------|---------|
| `src/tests/dates.test.ts` | 20 | `lib/dates.ts` |
| `src/tests/migrator.test.ts` | 26 | `services/migrator.ts` |
| `src/tests/state-helpers.test.ts` | 42 | `lib/state-helpers.ts` |

---

## CI Pipeline

Every push to `main`: install → test (88) → TypeScript check → build → deploy to GitHub Pages.

---

## Known Limitations / Not Yet Implemented

- No workout scheduling or planning ahead (future weeks work but no structured plan view)
- No push notifications or reminders
- No export / backup UI (cloud sync is implicit)
- iOS vibration not available — Web Vibration API unsupported on Safari/iOS
- Undo covers only set deletion (not set done toggle or exercise deletion)
- SearchOverlay uses local PS_UTC computation (cosmetic duplication, not a bug)

---

## Protected — Do Not Touch Without Explicit Request

- Auth flow and session handling
- Boot flow and bootstrapState
- Cloud sync logic (saveCloud / scheduleSave)
- Storage schema key names and version
- Date/weekday alignment logic
- Superset code pairing logic
- `immediate=true` flag on `updateState` — only for critical state
- `lib/state-helpers.ts` — pure functions used by both store actions and tests
