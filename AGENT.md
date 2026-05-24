# AGENT.md

This project uses **Timo Training Agent v3**.

Before making any change, read and follow:

```text
docs/AGENT_V3.md
```

## Repo Track Clarification

This repo contains separate tracks that must not be mixed by default:

### MVP1 / current working app

- This is the active production-like solution
- Source of truth is the current working `index.html`
- Use this as the baseline for normal fixes unless explicitly told
  otherwise

### V2 architecture scaffold

- This is a separate clean architecture base
- It is not the active app
- It is not the current production baseline
- Do not treat it as the implementation source of truth unless the task
  explicitly switches to V2

### Pre-v2 stabilization docs

- These docs exist to stabilize MVP1 before deeper V2 work
- They do not replace MVP1 implementation

Until explicitly stated otherwise, MVP1 remains the source of truth.

## Core Rule

**Stability over cleverness.**

A working production-like state is more valuable than a cleaner but broken file.

---

## Mandatory Development Rules

### 1. Always start from the latest confirmed working baseline

Do not build from:
- broken versions
- discarded versions
- experimental files
- unconfirmed branches

If the baseline is unclear, stop and confirm it first.

---

### 2. One iteration = one zone

Each change must be limited to one clearly bounded area.

Allowed examples:
- CSS-only polish for one UI area
- one isolated JS behavior
- documentation-only update
- one bug fix in one flow

Not allowed:
- calendar + auth + layout changes together
- cleanup + new feature together
- CSS + DOM movement + JS rewiring together

---

### 3. Protected zones are high risk

Do not touch these unless the task explicitly requires it:

- auth flow
- sign in / sign out
- Supabase session handling
- cloud sync
- boot flow
- render order
- overlays
- lock / PIN behavior
- calendar logic
- date alignment
- storage / migration
- workout completion flow
- data normalization
- localStorage schema
- IDs, classes, JS hooks, or dataset attributes used by JavaScript

---

### 4. Preserve workout data exactly

Never:
- mix weekdays and dates
- change week numbers randomly
- reorder exercises unless explicitly requested
- break superset structure
- convert supersets into singles
- drop sets
- drop reps
- drop weights
- drop done states
- silently normalize data without explaining it

Always preserve:
- workout day
- date
- week number
- exercise order
- exercise type: `single` or `superset`
- all sets
- all reps
- all weights
- all done states

---

### 5. Patch discipline

Every patch must be:

- narrow
- reversible
- based on the latest confirmed working version
- limited to one zone
- limited to one layer unless explicitly justified
- tested manually
- explained before delivery

No broad rewrites.
No hidden improvements.
No “while I was here” changes.

---

### 6. Required safety check before delivery

Before delivering any change, confirm:

- data structure preserved
- supersets preserved
- done states preserved
- exercise order preserved
- calendar/date logic untouched unless explicitly requested
- auth/render/overlay flow untouched unless explicitly requested
- patch is narrow and reversible

---

### 7. Manual test checklist

After every change, test at minimum:

- normal browser load
- incognito load
- calendar selection
- workout view
- add exercise
- search
- delete set
- delete exercise
- finish workout
- timer flow if relevant
- sign in/sign out if touched or visually nearby

If any critical flow fails:
- rollback immediately
- do not patch over a broken state

---

## Default Prompt

Use this when asking an AI coding tool to change the app:

```text
Use Timo Training Agent v3.

Baseline:
[latest confirmed working branch/file]

Task:
[exact requested change]

Strict scope:
- Change only the requested area.
- Do not combine unrelated fixes.
- Do not add extra improvements.
- Keep the patch narrow and reversible.

Protected zones:
- Do not touch auth unless explicitly requested.
- Do not touch overlays unless explicitly requested.
- Do not touch render/boot flow unless explicitly requested.
- Do not touch calendar/date logic unless explicitly requested.
- Do not touch Supabase/cloud sync unless explicitly requested.
- Do not touch storage/migration unless explicitly requested.
- Do not rename IDs/classes/JS hooks/dataset attributes unless explicitly required.

Data integrity:
- Preserve all exercises.
- Preserve all sets.
- Preserve all reps and weights.
- Preserve single vs superset structure.
- Preserve all done states.
- Preserve exercise order.
- Preserve weekday/date/week alignment.

After patch:
- Explain what changed.
- Explain what was intentionally untouched.
- Explain risk level.
- Explain why the patch is safe.
- Provide manual test checklist.
- Provide rollback instruction.
```

---

## Short Invocation

Use this in ChatGPT / Codex / VS Code:

```text
Use Timo Training Agent v3 → [task]
```

Example:

```text
Use Timo Training Agent v3 → fix mobile comma input in weight field
```

---

## Final Rule

Never trade a working production-like state for a cleaner file unless the change is bounded, tested, reversible, and based on the latest confirmed working baseline.

---

## Claude Workflow (Cowork)

This project is built using Claude via the Cowork desktop app.

### How to work effectively

- Use **Cowork** (not the web chat) — Claude has direct access to the repo folder and memory persists across sessions
- **One conversation = one task** — keep each session focused on a single change or bug fix
- If a conversation gets long or slow, **open a new Cowork session** in the same project — memory and repo access reload automatically
- Claude edits `index.html` directly in the repo
- Timo tests locally in the browser before committing
- Timo runs `git commit` + `git push` — Claude does not push

### Git workflow

1. Claude makes the change and explains exactly what was modified and why
2. Timo tests locally
3. Timo commits: `git commit -m "description"`
4. Timo pushes: `git push`

Claude never commits or pushes. Claude never assumes the change is safe — Timo confirms after local testing.
