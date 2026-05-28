# Current Baseline — Timo Training V2

**Last updated:** 2026-05-29

## Active App: V2

V2 is the production app. MVP1 (index.html) is legacy — do not modify.

- Source: `v2-app/`
- Deployed: GitHub Pages from `v2-dist/`
- Latest commit: `6db847f` — test suite (88 tests), CI pipeline, refactor

---

## Confirmed Working Features

### Auth
- Email/password sign in via Supabase
- Auth-first boot — no content shown before sign in
- Sign out via icon button in topbar

### Boot flow
- BootOverlay shown during Supabase session check + data load
- Cloud state loaded first; local state used as fallback
- Empty local state never overwrites populated cloud state

### Calendar
- Month calendar with dot markers for days with data
- Week strip with day picker — defaults to today on boot
- Tapping a day shows that day's exercises

### Exercise management
- Add exercise (search + select or free-text)
- Delete exercise
- Edit exercise name, type (single/superset/conditioning/recovery)
- Reorder exercises (up/down arrows)
- Add set / delete set

### Workout mode
- Full-screen overlay, block-by-block navigation
- Swipe left/right to navigate blocks
- Set done toggle per set — immediate cloud save (no done state loss)
- Wake Lock — screen stays on during workout
- Timer with elapsed display in header
- Rest timer — auto-starts after set done, persists through overlay close/reopen
- Rest timer: sound toggle (default OFF — no music interruption on iOS)
- Rest timer: 5-second vibration countdown (one buzz/second on Android)
- Rest timer: pulse animation on number during last 5 seconds
- Rest timer presets — 1' / 1:30 / 2' / 2:30 / 3' quick-start buttons when no timer is running
- kg ±2.5 buttons — one tap to adjust weight up or down on every set row
- Progress from previous session shown inline (last session kg × reps)
- Progressive overload hint — "→ Try X+2.5kg?" appears when same weight used as last session
- Inline exercise rename — ✎ button next to name, edits without leaving workout mode
- Add exercise within workout mode — inline input, no need to exit
- Session note — per-day free-text note, collapsible textarea, persisted to WorkoutDay
- Undo set delete — 5-second toast with Undo button after accidental deletion
- Workout summary overlay on finish (duration, sets done, total volume)
- Conditioning block: free-text note field
- Recovery block: single done toggle

### Data persistence
- localStorage (schema 4.0) — primary local storage, always written first
- Supabase cloud sync — 3s debounced on normal changes
- Critical state changes (set done, workout complete) bypass debounce → immediate cloud save
- MVP1 → V2 import migration (one-time banner if old data detected)

### Stats (inline, collapsible)
- Positioned after week strip, before exercise list
- Body map (muscle group visualization by zone, clickable toggle per muscle group)
- Summary chips: total weeks, sets done, volume
- Volume sparkline (last 8 weeks)
- Weekly breakdown table
- Most trained exercises — with plateau detection (→ badge when no weight increase in 3+ sessions)
- Per-exercise progression chart — tap any exercise to expand inline kg-over-time bar chart

### Design
- Dark Glass theme — navy radial gradient bg
- Premium gold: #c49230 (primary), #d4a038 (title)
- Minimal Crown header with gold accent line
- Blue-tinted glass cards and borders
- Sticky topbar + backdrop blur

---

## Data Model: Schema 4.0

```
WorkoutDay { week, day, date, exercises[], completed?, note? }
Exercise   { id, name, type, code, sets[], rest, note,
             recovery, recoveryDone,
             conditioning, conditioningNote, conditioningDone }
WorkoutSet { kg, reps, done }
```

Superset uses `type: 'superset'` + matching `code` ('A', 'B', ...) across exercises.

`WorkoutDay.note` is optional — written only when user adds a session note.

---

## Test Suite

88 automated tests across 3 modules — run with `npm test` in `v2-app/`.

| File | Tests | Coverage |
|------|-------|---------|
| `src/tests/dates.test.ts` | 20 | `lib/dates.ts` — week/day arithmetic, DST boundary, round-trips |
| `src/tests/migrator.test.ts` | 26 | `services/migrator.ts` — MVP1 detection, migration, V2 normalisation |
| `src/tests/state-helpers.test.ts` | 42 | `lib/state-helpers.ts` — all set/exercise state transformations, undo round-trip, workout block grouping |

---

## CI Pipeline

Every push to `main` runs in sequence — any failure blocks the next step:

1. **Install deps** — `npm ci`
2. **Run tests** — `npm test` (88 Vitest tests)
3. **TypeScript check** — `npm run check` (svelte-check + tsc)
4. **Build** — `vite build`
5. **Deploy** — GitHub Pages

---

## Known Limitations / Not Yet Implemented

- No workout scheduling / planned vs actual
- No notifications or reminders
- No export / backup UI (cloud sync is implicit)
- PWA install available but no push notifications
- Undo only covers set deletion (not set done toggle or exercise deletion)

---

## Protected — Do Not Touch Without Explicit Request

- Auth flow and session handling
- Boot flow and bootstrapState
- Cloud sync logic (saveCloud / scheduleSave)
- Storage schema key names and version
- Date/weekday alignment logic in Calendar and MonthCalendar
- Superset code pairing logic
- `immediate=true` flag on `updateState` — only for critical state (set done, workout complete, rename)
- `lib/state-helpers.ts` — pure functions used by both store actions and tests; changes here affect both
