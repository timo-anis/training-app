# AGENT.md — Timo Training App

## Active App

**V2 is the active production app.**

- Source: `v2-app/` (Svelte + TypeScript + Vite)
- Build output: `v2-dist/`
- Deployed: GitHub Pages from `v2-dist/`
- Live: https://timo-anis.github.io/training-app/

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Svelte 5 + TypeScript |
| Build | Vite |
| Auth + Cloud | Supabase |
| Local storage | localStorage (schema 4.0) |
| Theming | CSS tokens in `app.css` — dark + presentation themes (see THEME_SYSTEM.md) |
| Deployment | GitHub Pages |

---

## Architecture

### Component tree

```
App.svelte
├── BootOverlay.svelte          — loading screen
├── AuthView.svelte             — sign-in screen (signed out)
└── [app-shell]                 — signed in
    ├── scroll-content
    │   └── MainView.svelte (TopBar.svelte = title + sync + actions)
    │       ├── topbar          — sticky header (Minimal Crown + gold accent line)
    │       ├── MonthCalendar.svelte — sole day/week navigator (tap any day)
    │       ├── [stats-toggle]  — collapsible Stats section
    │       │   └── StatsView.svelte
    │       │       └── BodyMap.svelte
    │       ├── ExerciseCard.svelte (xN)
    │       │   └── CopyDaySheet.svelte   — copy-from-day bottom sheet
    │       │   └── SetRow.svelte (xN)
    │       └── AddExercise.svelte
    ├── workout-bar             — bottom CTA (when exercises exist)
    ├── WorkoutMode.svelte      — full-screen overlay (when active); owns state, delegates UI to:
    │   ├── WmHeader.svelte       — header (progress, clock, segment dots)
    │   ├── WmFooter.svelte       — footer nav (prev / back / next / finish)
    │   ├── WmRestControls.svelte — rest-timer adjust / start / presets
    │   ├── WmAddExercise.svelte  — in-workout add-exercise panel
    │   ├── WmSummary.svelte      — end-of-workout summary overlay
    │   └── WmSetRow.svelte       — per-set editor (kg/reps, done, delete)
    │   └── RestTimer.svelte    — focus mode (fullscreen) or compact (minimized)
    └── OnboardingOverlay.svelte — first-run walkthrough; re-openable via topbar Quick guide
```

### State layer (v2-app/src/stores/)

`app.ts` is a barrel re-export — import from here as before. Domain modules:

| Module | Contents |
|--------|----------|
| `ui-state.ts` | theme, currentUser, uiState, bootStatus, toast/showToast, searchOpen, sheetOpen, requestOnboarding, undo system, updateUI |
| `sync.ts` | syncStatus, scheduleSave, retry/backoff logic, online flush |
| `workout-state.ts` | appState, all derived stores, all mutations, bootForUser |

| Key store | Type | Purpose |
|-----------|------|---------|
| appState | AppState | All workout data — { weeks: WorkoutDay[], schema: '4.0' } |
| uiState | UIState | Selected week/day, workout flags, timer timestamps |
| currentUser | User or null | Supabase auth user |
| bootStatus | 'idle' \| 'loading' \| 'ready' \| 'error' | App boot phase |
| syncStatus | 'idle' \| 'saving' \| 'saved' \| 'error' | Cloud sync state |

Key derived stores: currentDayExercises, workoutBlocks, availableWeeks, canUsePresentation.

### Services (v2-app/src/services/)

| File | Purpose |
|------|---------|
| auth.ts | Supabase auth (sign in, sign out, onAuthChange — fires only on INITIAL_SESSION and SIGNED_IN) |
| storage.ts | bootstrapState, saveLocal, saveCloud — localStorage + Supabase sync |
| supabase.ts | Supabase client singleton |
| state-parser.ts | parseAndMigrateState — parse + normalise stored V2 state (backfills schema fields added after launch) |

### PWA / updates

The app is a PWA (vite-plugin-pwa, `registerType: 'autoUpdate'`). The service worker auto-reloads the page when a new build activates. `main.ts` additionally calls `registration.update()` on `visibilitychange`, so an installed iOS home-screen app re-checks for a new version every time it returns to the foreground — iOS standalone apps resume without a page load and would otherwise stay on a stale version.

---

## Data Model (v2-app/src/types/workout.ts, schema 4.0)

```typescript
WorkoutDay {
  week: number
  day: DayOfWeek          // 'Monday' | 'Tuesday' | ... | 'Sunday'
  date: string            // ISO: '2026-05-25'
  exercises: Exercise[]
  completed?: boolean     // user tapped Finish → green calendar dot
  note?: string           // free-text session note
  kind?: 'workout' | 'recovery' | 'rest'  // user-marked day type; undefined = unmarked
}

Exercise {
  id: string
  name: string
  type: 'single' | 'superset'
  code: string            // superset group: 'A', 'B', ... — '' for singles
  sets: WorkoutSet[]
  rest: string
  note: string
  recovery: boolean       // recovery/mobility block — no sets, just toggle
  recoveryDone: boolean
  conditioning: boolean   // bike, row, etc. — free-text log
  conditioningNote: string
}

WorkoutSet {
  kg: string
  reps: string
  done: boolean
}
```

### Non-negotiable data rules

- Never mix weekdays and dates
- Never break superset structure (type + code must stay paired)
- Never reorder exercises unless explicitly requested
- Never drop sets, reps, weights, or done states
- Never silently normalize or migrate data

---

## Design System

Theme: Dark Glass

| Token | Value |
|-------|-------|
| Background | radial-gradient(ellipse at 50% 0%, #0d1a2e 0%, #08090f 52%, #050508 100%) |
| Gold primary | #c49230 |
| Gold title | #d4a038 |
| Gold rgba base | rgba(196,148,46,x) |
| Border default | rgba(60,90,165,0.16) |
| Border card | rgba(70,110,185,0.22) |
| Glass input bg | rgba(13,24,52,0.85) |
| Card bg | linear-gradient(160deg, #0d1a30, #080e1c) |
| Done / active | #4fc08d |
| Text primary | #e8f0ff |
| Topbar bg | rgba(7,9,18,0.92) + backdrop-filter: blur(12px) |

Crown accent line (topbar top edge):
linear-gradient(90deg, transparent, rgba(196,148,46,0.45) 15%, #c49230 50%, rgba(196,148,46,0.45) 85%, transparent)

---

## Development Rules

### 1. Source of truth

V2 source is v2-app/src/. Always build from there, deploy from v2-dist/.

### 2. One change = one bounded area

Do not combine unrelated fixes. Each patch must be narrow and reversible.

### 3. Protected flows — do not touch unless explicitly requested

- Auth flow (sign in / sign out / session)
- Boot flow (bootstrapState, BootOverlay)
- Cloud sync (saveCloud, Supabase session)
- Storage schema (localStorage key names, schema version)
- Date/weekday alignment logic
- Superset structure logic

### 4. Pre-patch checklist

Before writing any change, confirm:

- Working from latest main branch
- Change is scoped to one file/area
- Data structure unchanged (unless data change is the task)
- Superset structure preserved
- Done states preserved
- Exercise order preserved
- Calendar/date logic untouched (unless explicitly requested)
- No store field names renamed without explicit reason

### 5. Build (and test) before commit

Always run npm run build in v2-app/ and confirm a clean build before committing.
Run npm test as well when logic/state/date code changed (all tests must pass).

---

## Workflow

1. Claude edits files in v2-app/src/
2. Claude runs: cd v2-app && npm run build  (clean build required)
3. Claude runs: npm test  (when logic/state changed — all tests must pass)
4. Claude commits and pushes: git add -A && git commit -m "..." && git push
5. CI runs test → typecheck → build → deploy. Live on GitHub Pages after push.

**Workflow decision (2026-06-01):** stay on this build → push → live flow — reliable and
low-friction. No preview branch for now; revisit only if test-before-deploy becomes a real need.
Safety net: build + tests pass locally before every push.

---

## File Map

```
training-app/
├── v2-app/               ACTIVE SOURCE
│   ├── src/
│   │   ├── App.svelte
│   │   ├── app.css
│   │   ├── main.ts
│   │   ├── components/   (13 components — incl. CopyDaySheet.svelte)
│   │   ├── stores/app.ts          (barrel re-export)
│   │   ├── stores/ui-state.ts     (theme, auth, uiState, undo, toast)
│   │   ├── stores/sync.ts         (syncStatus, scheduleSave, retry)
│   │   ├── stores/workout-state.ts (appState, derived, mutations, boot)
│   │   ├── services/     (auth, storage, supabase, state-parser)
│   │   └── types/workout.ts
│   └── package.json
├── v2-dist/              DEPLOYED BUILD (auto-generated by CI, gitignored — do not edit)
├── AGENT.md              this file
└── CURRENT_BASELINE.md   current state summary
```
