# Current Baseline — Timo Training V2

**Last updated:** 2026-05-31

## Active App: V2

- Source: `v2-app/`
- Deployed: GitHub Pages — https://timo-anis.github.io/training-app/v2/
- MVP1 (`index.html`) is legacy — do not touch

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
- Day colors: green = fully done, amber ◑ = partial (some sets done), amber ring = recovery, white = has data
- Future days: clickable (for planning), cursor pointer
- Legend: Done / Partial / Workout / Recovery / Weekend

### Calendar — week strip
- Day pill labels: white/visible
- goToToday: sets both week and day

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

### Sync + topbar
- Cloud sync dot: pulsing amber (saving) → green 2.5s (saved) → idle
- Sync status visible in topbar

### Account sheet
- z-index 200 — above workout bar
- Workout bar hidden when sheet open

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
