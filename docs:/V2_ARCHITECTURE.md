# V2 Architecture — Timo Training

**Status: active production app as of 2026.**
Live at https://timo-anis.github.io/training-app/v2/

---

## Overview

V2 is a Svelte 4 + TypeScript single-page PWA. It replaces MVP1 (a single `index.html` file). The core design constraints are:

- Data integrity first — no broken states, no misaligned dates
- Speed during workout execution — minimal taps, zero friction
- Reliable offline + cloud sync — local always available, Supabase syncs when online
- Predictable, extensible architecture — one state store, one data model

---

## Domain Model

Defined in `src/types/workout.ts` — single source of truth.

```
AppState
└── weeks: WorkoutDay[]
    └── WorkoutDay { week, day, date, exercises[], completed?, note? }
        └── Exercise { id, name, type, code, sets[], rest, note,
                       recovery, recoveryDone,
                       conditioning, conditioningNote, conditioningDone }
            └── WorkoutSet { kg, reps, done }
```

### Key types

**WorkoutDay**
- `week: number` — 1-based, derived from PROGRAM_START (2026-02-16)
- `day: DayOfWeek` — Mon–Sun, aligned with UTC arithmetic to avoid DST issues
- `date: string` — ISO date `'YYYY-MM-DD'`
- `completed?: boolean` — set when user taps "Finish Training"

**Exercise**
- `type: 'single' | 'superset'`
- `code: string` — superset group letter (e.g. `'A'`), empty for singles
- `recovery: boolean` — mobility/foam roll block, no sets, just a done toggle
- `conditioning: boolean` — bike/row/etc., free-text note instead of sets

**AppState**
- `schema: '4.0'` — drives migration logic in `services/migrator.ts`

**UIState** (in store, not persisted)
- `week, day` — currently selected week/day
- `workoutActive, workoutMode` — workout timer vs. overlay state
- `workoutStartTime, restStartTime, restTotal` — timer state, survives overlay close/reopen
- `calendarCollapsed` — month calendar collapse state
- `highlightExercise` — exercise name to scroll into view after search navigation

---

## Shared Library Modules (`src/lib/`)

### `lib/program.ts`
Single source of truth for `PS_UTC = Date.UTC(2026, 1, 16)` (PROGRAM_START).

### `lib/dates.ts`
Exported date arithmetic utilities — shared by `stores/app.ts`, `services/migrator.ts`, and tests.

```typescript
getDateForWeekDay(week, day): string   // { week, day } → 'YYYY-MM-DD'
getWeekDayForDate(date): { week, day } | null  // 'YYYY-MM-DD' → { week, day }
DAY_OFFSET: Record<DayOfWeek, number>  // Monday=0 … Sunday=6
```

### `lib/state-helpers.ts`
Pure state transformation functions — no side effects, no store access, no Supabase.
Used by store actions in `stores/app.ts` and directly tested in `src/tests/state-helpers.test.ts`.

```typescript
mapExercise(state, week, day, exId, updater)
toggleSetDoneInState / deleteSetFromState / insertSetInState / addSetToState / updateSetFieldInState
deleteExerciseFromState / renameExerciseInState / moveExerciseInState
buildWorkoutBlocks(exercises): WorkoutBlock[]
```

Store actions in `app.ts` delegate to these helpers: `updateState(state => helperFn(state, ...))`.

---

## Week / Date Arithmetic

**PROGRAM_START = 2026-02-16 (Monday)**

All week numbers and day assignments derive from this epoch using UTC arithmetic to avoid DST issues. The DST spring-forward (Europe, 2026-03-29) falls inside Week 6 — UTC arithmetic means the date is unaffected by the timezone offset change.

```typescript
const PS_UTC = Date.UTC(2026, 1, 16);  // from lib/program.ts

// { week, day } → 'YYYY-MM-DD'  (lib/dates.ts: getDateForWeekDay)
const utc = PS_UTC + ((week - 1) * 7 + DAY_OFFSET[day]) * 86400000;

// 'YYYY-MM-DD' → { week, day }  (lib/dates.ts: getWeekDayForDate)
const diff = Math.round((Date.UTC(y, m - 1, d) - PS_UTC) / 86400000);
week = Math.floor(diff / 7) + 1;
day  = DAY_ORDER[diff % 7];
```

Used by `MonthCalendar.svelte`, `Calendar.svelte`, `stores/app.ts`, and `services/migrator.ts` — all import from `lib/dates.ts`.

---

## State Architecture

Single store in `src/stores/app.ts`. No external state library.

### Stores

| Store | Type | Purpose |
|-------|------|---------|
| `appState` | `Writable<AppState>` | All workout data |
| `uiState` | `Writable<UIState>` | UI selection, workout mode, timers |
| `currentUser` | `Writable<User \| null>` | Supabase auth user |
| `bootStatus` | `Writable<BootStatus>` | `'idle' \| 'loading' \| 'ready' \| 'error'` |
| `searchOpen` | `Writable<boolean>` | Global search overlay toggle |

### Derived stores

| Derived | Source | Output |
|---------|--------|--------|
| `availableWeeks` | appState + uiState | Sorted list of weeks with data + current week |
| `currentWeekDays` | appState + uiState | WorkoutDays for selected week |
| `currentDayExercises` | appState + uiState | Exercises for selected day |
| `latestWeek` | availableWeeks | Last week number |
| `workoutBlocks` | currentDayExercises | Grouped exercise blocks (single or superset) |
| `hasMvp1Data` | currentUser | Whether MVP1 localStorage key exists |

### Actions (all in `stores/app.ts`)

All state mutations go through `updateState(updater, immediate?)`, which calls `scheduleSave` on every change.

`immediate = true` bypasses the 3s cloud debounce and fires a cloud save immediately (fire-and-forget). Only use for state changes where data loss on sudden app close would be unacceptable.

Store actions delegate pure state logic to `lib/state-helpers.ts` — the action only handles the `updateState` wrapper and the `immediate` flag.

Core actions: `addExercise`, `deleteExercise`, `moveExercise`, `updateExerciseMeta`, `renameExercise`, `addSet`, `deleteSet`, `insertSet`, `toggleSetDone`, `updateSetField`, `toggleRecoveryDone`, `toggleConditioningDone`, `updateConditioningNote`, `updateDayNote`, `copyPreviousDay`, `addNewWeek`, `markWorkoutComplete`, `startWorkout`, `openWorkoutMode`, `closeWorkoutMode`, `exitWorkout`

Actions using `immediate = true`: `toggleSetDone`, `toggleRecoveryDone`, `toggleConditioningDone`, `markWorkoutComplete`, `renameExercise`, `updateDayNote`

---

## Storage & Sync

### Local storage key

```
timo_training_v4__user__{userId}
```

### Bootstrap sequence (on sign-in)

1. `loadCloud(userId)` — fetch from Supabase `app_state` table
2. If cloud has data → use cloud
3. Else `loadLocal(userId)` — read from localStorage
4. Else → empty state

Cloud always wins. This means the last device to sync is the source of truth.

### Save strategy

Every `updateState(updater, immediate?)` call:
1. `saveLocal(userId, state)` — synchronous, always immediate
2. `scheduleSave(userId, state, immediate)`:
   - If `immediate = false` (default): debounced 3 seconds → `saveCloud(userId, state)`
   - If `immediate = true`: fire-and-forget `saveCloud(userId, state)` with no delay

Default debounce protects against excessive Supabase writes during rapid set logging. `immediate = true` prevents done-state loss if iOS kills the PWA within 3s of the last interaction.

---

## Boot & Migration Pipeline

Runs once on every sign-in inside `bootForUser(user)`:

```
bootstrapState(userId)          // load cloud or local
  → clearWednesdayRecoveryDays  // remove incorrect MVP1 import data from W2–W7 Wednesdays
  → cleanupBackfilledRecovery   // remove auto-generated Active Recovery exercises (ID prefix: active_recovery_w)
  → applyPastDaysCompleted      // mark all past training days completed=true, all sets done=true
  → save if any patch changed
  → set latest week as selected week
  → bootStatus = 'ready'
```

### Schema migration (`services/migrator.ts`)

Handles:
- MVP1 flat format → V2 structured format
- Schema upgrades (schema 1.x → 4.0)
- Backfill missing fields (`conditioningDone`, `conditioningNote`, etc.)

---

## Component Tree

```
App.svelte
├── BootOverlay.svelte          (shown during loading)
├── AuthView.svelte             (shown when signed out)
└── [signed in + ready]
    ├── scroll-content
    │   └── MainView.svelte
    │       ├── MonthCalendar.svelte
    │       ├── Calendar.svelte         (week strip + day picker)
    │       ├── StatsView.svelte        (collapsible)
    │       │   └── BodyMap.svelte
    │       ├── ExerciseCard.svelte     (× N)
    │       │   ├── SetRow.svelte       (× N sets)
    │       │   └── [edit bottom sheet — fixed overlay]
    │       └── AddExercise.svelte
    ├── workout-bar                     (bottom bar — Start / Resume + timer)
    ├── WorkoutMode.svelte              (full-screen overlay, z-index 100)
    │   └── RestTimer.svelte            (inline pill, per-block)
    └── SearchOverlay.svelte            (z-index 91)
```

---

## Component Responsibilities

### App.svelte
Root shell. Manages auth subscription, scroll layout (`flex: 1 1 0; overflow-y: auto`), bottom workout bar, and renders `WorkoutMode` + `SearchOverlay` at top level (above scroll-content in DOM order).

### MainView.svelte
Main content column. Shows month calendar, week strip, stats toggle, day heading with progress (X/Y), exercise list, and AddExercise. Handles MVP1 migration banner.

### MonthCalendar.svelte
Month grid with collapsible toggle. Computes `getDayStatus` for each date:
- `done` — completed flag or all non-recovery sets done
- `active-recovery` — Wednesday (always amber, including future Wednesdays)
- `has-data` — workout logged but not fully done
- `rest` — past weekday, no data
- `weekend` — Saturday/Sunday
- `future` — future dates (except Wednesdays)

### Calendar.svelte
Horizontal week strip. Shows days in current week, highlights selected day. Today button appears when not on today's week.

### ExerciseCard.svelte
Card per exercise. Shows name, type badge (superset/conditioning only, not "Weighted"), sets via SetRow. Edit opens a fixed bottom sheet (`position: fixed; height: min(88dvh, 600px)`) with name, type toggle, group code, rest, note, and order buttons.

### SetRow.svelte
Single set row — kg input, reps input, done button. Commits values on blur.

### WorkoutMode.svelte
Full-screen focused overlay (`z-index: 100`). Renders exercise blocks one at a time with swipe navigation. Shows last session values. Prefills kg/reps from last session. Rest timer inline per block. Summary screen after last block.

**Inline exercise rename**: small ✎ button next to exercise name. Tapping opens an inline input (gold border, auto-focus, select-all). Enter or blur commits via `renameExercise`. Escape cancels. Resets on block navigation.

**kg ±2.5 buttons**: `−` and `+` buttons inside each kg set-col. `adjustKg()` reads `localKg`, applies delta, rounds to 2dp, writes back via `updateSetField`.

**Rest timer presets**: when `!restActive` and block has strength exercises, shows `REST 1' · 1:30 · 2' · 2:30 · 3'` row. Calls `startRestSecs(secs)` directly — bypasses the string parser.

**Progressive overload hint**: reactive `{@const}` in the `last-session` row — shows `→ Try X+2.5kg?` when `localKg` for set 0 matches `lastSession.sets[0].kg` and at least one set is done. Animates in with a pop.

**Add exercise**: `+ Add exercise` trigger button shows inline input row. Calls existing `addExercise` store action. Workout blocks re-derive automatically.

**Session note**: `WorkoutDay.note` field. Initialized once on component mount from `appState`. Collapsible textarea. On blur or close, calls `updateDayNote` (immediate cloud save).

**Undo set delete**: `handleDeleteSet` captures the set and index before calling `deleteSet`. `pushUndo()` stores the reverse action with a 5-second timeout. `execUndo()` calls `insertSet` to re-insert at the original index. Undo toast is an `position: absolute` overlay inside `wm-content`.

### RestTimer.svelte
Compact inline pill. Progress bar fill, countdown display, GO! on completion. Reset and Skip buttons. Timer state lives in `uiState` (survives overlay close).

Sound toggle (🔇/🔔) defaults to OFF — preserves iOS background audio. Preference persisted to `timo_training_v4_sound_enabled` in localStorage. `playBeep()` is a no-op when sound is off.

5-second countdown: one 60ms vibration per second via `navigator.vibrate(60)`, tracked by `lastCountdownAt` to prevent double-fires. Pulse animation on the timer number.

On completion: always vibrates `[220, 80, 220]`; plays ascending three-tone beep only when sound is on.

### StatsView.svelte
Collapsible panel below week strip. Summary chips (weeks / sets / volume). Volume sparkline (last 8 weeks). Weekly breakdown table. Exercise frequency list. Body map.

**Plateau detection**: `hasPlateau(name, weeks)` uses `getExerciseHistory()` — collects max kg per week (done sets only, deduped to one entry per week), checks if last 3 values are identical. Result memoized into `plateauSet` reactive Set. Exercises with plateau show a `→` gold badge.

**Per-exercise progression chart**: `selectedExForChart` string. Clicking exercise name toggles it. When selected, `getExerciseHistory()` returns up to 8 sessions shown as a gold bar chart (same visual style as volume sparkline). Bars scale to `histMax`. Chart attaches below the freq-row with connected border styling.

### BodyMap.svelte
SVG muscle group visualization. Three modes: day / week / lifetime. Clickable muscle groups.

### SearchOverlay.svelte
Full-screen search (`z-index: 91`). Searches across all exercises by name. Tapping a result navigates to that week/day and scrolls to the exercise.

### AddExercise.svelte
Bottom input bar for adding new exercises to current day.

---

## z-index Hierarchy

| Layer | Value | Component |
|-------|-------|-----------|
| Search backdrop | 90 | SearchOverlay |
| Search panel | 91 | SearchOverlay |
| Edit backdrop | 94 | ExerciseCard edit sheet |
| Edit sheet | 95 | ExerciseCard edit sheet |
| Workout mode | 100 | WorkoutMode |
| Summary overlay | 200 | WorkoutMode summary |
| Completion flash | 300 | WorkoutMode finish animation |

---

## Calendar Status Logic (Wednesday handling)

Wednesdays are always shown as amber (active-recovery) regardless of data or whether past/future. This is a visual convention — no exercise data is created automatically. The check runs before the future-date guard:

```typescript
if (date > todayMid) {
  if (wd && wd.day === 'Wednesday') return 'active-recovery'; // always amber
  return 'future';
}
```

---

## Test Suite

Framework: **Vitest 4** — run with `npm test` in `v2-app/`. 88 tests, all pure TypeScript (no Svelte runtime needed).

| File | Tests | What it covers |
|------|-------|----------------|
| `src/tests/dates.test.ts` | 20 | `lib/dates.ts` — week/day arithmetic, DST boundary (2026-03-29 in Week 6), round-trips, pre-start guard |
| `src/tests/migrator.test.ts` | 26 | `services/migrator.ts` — MVP1 detection, conversion (dates, sets, supersets, recovery, hidden exercises, multi-week), V2 normalisation |
| `src/tests/state-helpers.test.ts` | 42 | `lib/state-helpers.ts` — toggle, delete, insert, add set; undo round-trip (delete→insert); rename guards; move boundary; workout block grouping |

Tests cover the highest-risk logic: date arithmetic (DST), data migration, and state mutations. UI components are not tested — effort/value ratio is too low for a single-user app.

---

## CI Pipeline

`.github/workflows/deploy.yml` — triggers on push to `main`. Every step must pass or the pipeline stops.

```
1. npm ci                 (install deps)
2. npm test               (88 Vitest tests — logic + migration)
3. npm run check          (svelte-check + tsc — TypeScript correctness)
4. vite build             (produces v2-dist/)
5. deploy to gh-pages     (peaceiris/actions-gh-pages)
```

Env secrets required for build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`.

---

## Non-negotiable Rules

These rules are enforced throughout the codebase and must be respected in all future changes:

1. Never mix up weekdays and dates — always use UTC arithmetic
2. Never break superset structure — exercises group by `type === 'superset' && code`
3. Never randomly reorder exercises — order is meaningful
4. Never drop `done` states — they drive calendar status and progress counts
5. Never assume — inspect actual data structure before changing logic
6. Every `updateState` call saves — no silent in-memory mutations
7. Cloud always wins on boot — local is a fallback, not a source of truth
