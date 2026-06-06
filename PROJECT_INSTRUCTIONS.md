# Timo Training App — Project Instructions

## Context

This is a real, production training app that Timo uses daily — not a demo.

**Stack:** Svelte 5 + TypeScript + Vite + Supabase, deployed to GitHub Pages via CI.

Repo: `training-app`. Active source: `v2-app/src/`. Deployed build: `v2-dist/` (auto-generated).

The full architecture reference lives in `AGENT.md`; the current confirmed feature state lives in
`CURRENT_BASELINE.md`. Read those before non-trivial work.

## Goal

A clean, reliable, mobile-first training system where workouts are clearly structured, execution
during a workout is fast and frictionless, data is always correct, and logic stays predictable and
easy to extend.

## Core principles

- **Clarity over complexity** — readable, predictable logic; no unnecessary abstractions.
- **Reliability over cleverness** — no fragile hacks; must work consistently across sessions.
- **Speed of use** — user is mid-workout; minimal taps, zero confusion.
- **Data integrity first** — no broken states, no misaligned dates, no mixed exercise structures.
- **Minimum viable change** — smallest change that delivers the requested value. No gold-plating.

## Data model (schema 4.0 — source of truth: `v2-app/src/types/workout.ts`)

```
WorkoutDay { week:number, day:DayOfWeek, date:string (ISO), exercises:Exercise[] }
Exercise   { id, name, type:'single'|'superset', code, sets:WorkoutSet[],
             rest, note, recovery, recoveryDone, conditioning, conditioningNote }
WorkoutSet { kg, reps, done }
```

Non-negotiable data rules:

- Never mix weekdays and dates; keep week numbers consistent.
- Never break superset structure — `type` + `code` stay paired.
- Never reorder exercises unless explicitly asked.
- Never drop sets, reps, weights, or `done` states.
- Never silently normalize or migrate data.
- If unsure → ask, or preserve existing structure. Never guess.

## How to work

This is a component app, not an HTML file. There is no "deliver a new HTML file" step.

1. Edit the relevant files in `v2-app/src/` (components, stores, services).
2. Keep each change to **one bounded area** — do not combine unrelated fixes, do not add
   "small extra improvements" unless asked.
3. Do not rename store fields, IDs, classes, or JS hooks without an explicit reason.

## Protected flows — do not touch unless explicitly requested

Auth (sign in/out/session) · Boot (`bootstrapState`, BootOverlay) · Cloud sync (`saveCloud`,
Supabase session) · Storage schema (localStorage key names, schema version) · Date/weekday
alignment · Superset code pairing & grouping · `lib/state-helpers.ts` pure functions.

## Delivery workflow (the canonical loop)

1. Edit files in `v2-app/src/`.
2. Run `cd v2-app && npm run build` — must be clean before continuing.
3. Run `npm test` when logic/state code changed (133 tests must pass).
4. `git add -A && git commit -m "..." && git push`.
5. **Update docs** (no need to ask — always do this):
   - `CURRENT_BASELINE.md` if any feature description changed.
   - Memory: `project_assessment_open_items.md` — add ✅ line for the fix.
   - Memory: `project_training_app.md` — update if design system, calendar, or architecture changed.
6. CI runs test → typecheck → build → deploy. Live on GitHub Pages after push.

**Milestone tags:** when a meaningful feature set is complete (not every push), create a tag:
`git tag v2-<short-description>-YYYY-MM-DD && git push origin --tags`

## Definition of Done

A change is done when ALL of the following are true:

- [ ] Build is clean (`npm run build`)
- [ ] Tests pass (`npm test`) if logic/state was touched
- [ ] The change works in a real workout scenario (mental walkthrough)
- [ ] UX consistency check: if a visual pattern was changed, verify all related elements match
      (e.g. adding dashed circles to the legend → check if the calendar also needs them)
- [ ] Docs updated (CURRENT_BASELINE.md + memory files)
- [ ] Pushed and CI green

## Proactive flags — surface without being asked

Claude must raise the following proactively, without waiting to be asked:

- **Security / expiry:** PAT/token nearing expiry, exposed credentials.
- **Data risk:** anything that could cause data loss, corruption, or broken state.
- **UX inconsistency:** if changing one UI element creates a mismatch with a related element.
- **Missing safety net:** if a structural risk has no backup or rollback path.
- **Scope creep:** if while fixing X, Claude notices Y is also broken — flag it, do not silently fix it.

Format: one short sentence, clearly labelled (e.g. "⚠️ UX: legend shows dashed circles but calendar does not — fix?").

## Before delivering any change, confirm

- Built from the latest `main`; never from a discarded/experimental state.
- Change is narrow, scoped, and reversible.
- Data structure, date/weekday alignment, week numbers, exercise order, superset structure,
  all sets, and all `done` states are preserved.
- The change does not break: calendar selection, add/delete exercise, delete set, workout mode,
  finish workout, overlays, auth, boot/cloud/loading.
- State it plainly: what changed, what was intentionally left untouched, what risk was avoided.

## Working mode

Be precise, structured, practical. Think as product owner + frontend engineer + QA tester:
*Does this break existing logic? Is data still consistent? Would this work during a real workout?*
If something is unclear → ask before breaking things.

## Session hygiene

If a conversation gets long, slow, or context-heavy, stop and suggest continuing in a new chat
within the same project (with a short handoff summary) to keep decisions precise.
