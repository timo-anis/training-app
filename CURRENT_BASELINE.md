# Current Baseline — Timo Training V2

**Last updated:** 2026-05-26

## Active App: V2

V2 is the production app. MVP1 (index.html) is legacy — do not modify.

- Source: `v2-app/`
- Deployed: GitHub Pages from `v2-dist/`
- Latest commit: `f4e7686` — feat: remove top tabs, Stats inline toggle, premium gold #c49230

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
- Set done toggle per set
- Wake Lock — screen stays on during workout
- Timer with elapsed display in bottom bar
- Rest timer — auto-starts after set done, persists through overlay close/reopen
- Progress from previous session shown inline
- Workout summary overlay on finish
- Conditioning block: free-text note field
- Recovery block: single done toggle

### Data persistence
- localStorage (schema 4.0) — primary local storage
- Supabase cloud sync — saves on every change, loads on boot
- MVP1 → V2 import migration (one-time banner if old data detected)

### Stats (inline, collapsible)
- Positioned after week strip, before exercise list
- Body map (muscle group visualization by zone)
- Summary chips: total weeks, sets done, volume
- Weekly breakdown table
- Most trained exercises

### Design
- Dark Glass theme — navy radial gradient bg
- Premium gold: #c49230 (primary), #d4a038 (title)
- Minimal Crown header with gold accent line
- Blue-tinted glass cards and borders
- Sticky topbar + backdrop blur

---

## Data Model: Schema 4.0

```
WorkoutDay { week, day, date, exercises[] }
Exercise   { id, name, type, code, sets[], rest, note,
             recovery, recoveryDone, conditioning, conditioningNote }
WorkoutSet { kg, reps, done }
```

Superset uses `type: 'superset'` + matching `code` ('A', 'B', ...) across exercises.

---

## Known Limitations / Not Yet Implemented

- No per-exercise progression charts (only raw history visible)
- No workout scheduling / planned vs actual
- No notifications or reminders
- No export / backup UI (cloud sync is implicit)
- PWA install available but no push notifications

---

## Protected — Do Not Touch Without Explicit Request

- Auth flow and session handling
- Boot flow and bootstrapState
- Cloud sync logic (saveCloud)
- Storage schema key names and version
- Date/weekday alignment logic in Calendar and MonthCalendar
- Superset code pairing logic
