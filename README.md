# Timo Training

A mobile-first training app built for real daily use — fast logging during workouts, reliable state handling, and Supabase-backed cloud sync.

**V2 is the active app.** MVP1 (`index.html`) is retired.

---

## Live

**https://timo-anis.github.io/training-app/v2/**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Svelte 4 + TypeScript |
| Build | Vite |
| Auth + Cloud | Supabase (auth + `app_state` table) |
| Hosting | GitHub Pages (gh-pages branch, CI/CD via GitHub Actions) |
| PWA | Web App Manifest + service worker |

---

## Features

- Auth-first sign-in — Supabase email/password
- Cloud sync with local fallback — cloud wins on boot, 3-second debounced save on every change
- Month calendar with day status markers (done / workout / recovery / rest / weekend / future)
- Week strip + day picker with Today button
- Exercise logging — weighted sets (kg × reps), supersets, conditioning blocks, recovery blocks
- Workout Mode — focused full-screen overlay, block-by-block navigation, swipe gestures
- Inline rest timer — compact pill with progress bar, auto-starts on set done
- Workout timer — elapsed time chip in bottom bar, persists across overlay open/close
- Day progress indicator — X/Y exercises completed in current day heading
- Copy previous day / week — prefills kg/reps, resets done states
- Exercise search overlay
- Stats view — weekly volume sparkline, weekly breakdown, exercise frequency, body map
- Body map — muscle group visualization (day / week / lifetime radar)
- MVP1 data import banner — detects and migrates legacy localStorage data
- PWA installable — works offline, home screen icon

---

## Repository Structure

```
training-app/
├── index.html              # MVP1 — retired, kept for reference
├── v2-app/                 # V2 source (Svelte 4 + TS + Vite)
│   └── src/
│       ├── App.svelte          # Root — auth shell, scroll layout, workout bar
│       ├── app.css             # Global reset + font
│       ├── main.ts             # Vite entry
│       ├── types/
│       │   └── workout.ts      # Domain types (single source of truth)
│       ├── stores/
│       │   └── app.ts          # All state + actions + derived stores
│       ├── services/
│       │   ├── auth.ts         # Supabase auth wrapper
│       │   ├── storage.ts      # Local + cloud load/save + bootstrap
│       │   ├── supabase.ts     # Supabase client init
│       │   └── migrator.ts     # Schema migration (MVP1 → V2, schema upgrades)
│       └── components/
│           ├── AuthView.svelte
│           ├── BootOverlay.svelte
│           ├── MainView.svelte
│           ├── MonthCalendar.svelte
│           ├── Calendar.svelte
│           ├── ExerciseCard.svelte
│           ├── SetRow.svelte
│           ├── AddExercise.svelte
│           ├── WorkoutMode.svelte
│           ├── RestTimer.svelte
│           ├── StatsView.svelte
│           ├── BodyMap.svelte
│           └── SearchOverlay.svelte
├── v2-dist/                # Built output (gitignored, built by CI)
├── docs:/                  # Architecture + planning docs
│   └── V2_ARCHITECTURE.md
└── .github/workflows/      # GitHub Actions — build + deploy on main push
```

---

## Local Development

```bash
cd v2-app
npm install
npm run dev
```

Requires a `.env.local` with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Build for production:

```bash
npm run build   # outputs to ../v2-dist/
```

---

## Deployment

Push to `main` → GitHub Actions builds `v2-app` → deploys built output to `gh-pages` branch under `/v2/`.

GitHub Pages source: `gh-pages` branch, root `/`.

---

## Design Principles

- Clarity over complexity
- Speed during workouts — minimal taps, zero confusion
- Data integrity — no broken states, no misaligned dates
- Reliability over cleverness — predictable behavior across sessions

---

## Architecture

Full architecture reference: [docs:/V2_ARCHITECTURE.md](./docs:/V2_ARCHITECTURE.md)

---

## Author

**Timo Anis** — Product Lead
