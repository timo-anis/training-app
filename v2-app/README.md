# Timo Training — V2

Personal training log app. Mobile-first PWA.

## Stack

- Svelte 4 + TypeScript
- Vite
- Supabase (auth + cloud sync)
- GitHub Pages (deployment)

## Dev

```bash
cd v2-app
npm install
npm run dev       # local dev server
npm run build     # build to ../v2-dist/
```

## Deploy

Push to `main`. GitHub Pages serves from `v2-dist/`.

## Structure

```
src/
├── App.svelte          — root: auth/boot routing + workout bar
├── app.css             — global resets
├── main.ts             — entry point
├── components/
│   ├── MainView.svelte      — calendar + exercises + stats toggle
│   ├── WorkoutMode.svelte   — full-screen workout overlay
│   ├── ExerciseCard.svelte  — exercise display + edit
│   ├── SetRow.svelte        — single set row (kg/reps/done)
│   ├── Calendar.svelte      — week strip + day picker
│   ├── MonthCalendar.svelte — month view with dot markers
│   ├── StatsView.svelte     — stats + body map
│   ├── BodyMap.svelte       — muscle group SVG map
│   ├── AddExercise.svelte   — add exercise UI
│   ├── RestTimer.svelte     — rest timer component
│   ├── AuthView.svelte      — sign-in screen
│   └── BootOverlay.svelte   — loading screen
├── stores/
│   └── app.ts          — all app state (Svelte writables + derived)
├── services/
│   ├── auth.ts         — Supabase auth
│   ├── storage.ts      — localStorage + cloud sync
│   ├── supabase.ts     — Supabase client
│   └── state-parser.ts — parse/normalise stored V2 state
└── types/
    └── workout.ts      — domain types (schema 4.0)
```

## Data Model

See `src/types/workout.ts`. Schema version: 4.0.

Core: `WorkoutDay → Exercise[] → WorkoutSet[]`

Exercise types: `single`, `superset`, plus `recovery` and `conditioning` flags.
