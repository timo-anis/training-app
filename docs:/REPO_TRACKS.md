# Repository Tracks

This repository contains two tracks.

---

## Track 1: V2 — Active Production App

V2 is the current live app.

- Source: `v2-app/`
- Deployed: GitHub Pages from `v2-dist/`
- Stack: Svelte 4 + TypeScript + Vite + Supabase

All development happens here. See `AGENT.md` for architecture and rules.

---

## Track 2: MVP1 — Legacy

`index.html` is the original single-file app. It is no longer the active app.

Do not modify MVP1 unless explicitly requested.

It exists as:
- Historical reference
- Fallback if V2 needs to be compared against original behavior
- Source for the one-time data migration (handled by `services/migrator.ts`)

---

## Rule

V2 is the source of truth. When in doubt, work in `v2-app/src/`.
