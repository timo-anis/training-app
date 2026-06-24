# Desktop redesign — "A structure + B craft" (top-tier wide-browser trainee view)

**Status:** SPEC / not started. On-ramp for a FRESH session (track-by-track rule).
**Approved by Timo 2026-06-24** after the desktop framing shipped (`1ebe320`): the framed
panel fixed the "floating strip" but a 672px column on a ~2000px screen still wastes ~⅔ of the
width with purposeless dark void. Direction chosen: **A (real desktop layout that fills the
width with purpose) + B (editorial craft pass).** Desktop-only; mobile/PWA stays byte-identical.

## North star
A wide browser should look like a real product (Linear / Whoop web / Apple Fitness), not a phone
centred on a void. The width is filled with PURPOSE — today's session, context — not decoration.
"Top 0.01%" is won 80% in execution detail (type, spacing, consistency, micro-motion), so the
craft pass is where the tier is decided.

## Hard invariants (do NOT break — see PROJECT_INSTRUCTIONS.md / PATCH DISCIPLINE)
- **Mobile/PWA byte-identical**: every change gated behind `@media (min-width: 900px)`. Below
  900px the markup must render exactly as today (single column, current order).
- Single-writer intact: only the trainee client writes `app_state`. No coach writes. No data-model change.
- Workout flow untouched: start/resume/finish, RestTimer, superset auto-advance, RPE, materialize.
- No renaming IDs/classes/JS hooks/dataset attrs unless strictly required. No exercise reorder.
  Preserve done states. Don't touch auth/boot/sync/PWA/service-worker.
- Validate green every PR: `npm run check` 0/0 · `npx vitest run` (206+) · `npm run build`
  two-entry · verify on `gh-pages` (sandbox build is a phantom — see CURRENT_BASELINE.md).
- All colours via `--c-`/`--h-` tokens so presentation/light mode keeps working (THEME_SYSTEM.md).

## Layout (≥900px)
Keep `TopBar` full-width sticky across the top (avoids reworking sticky). Below it, turn the
single column into a CSS grid:

```
[ TopBar — full width, sticky ]
[ rail 200px | center minmax(0,1fr) | context 320–360px ]   gap ~16px, max-width ~1180px, centred
```

- **Rail (left):** compact streak stat (reuse `streakInfo`; smaller variant of `StreakStrip`),
  quick links (Stats / Search / Account — reuse existing actions/handlers), maybe week summary.
- **Center:** `MonthCalendar` (existing) + the selected-day detail ("Wednesday …") below it.
- **Context (right):** **Today's session** — the current day's exercises + the Start/Resume CTA
  that today lives in the bottom `.workout-bar` and below-the-fold day view. This is the single
  highest-value move: the actual job-to-be-done above the fold. Reuse existing components/stores;
  on desktop the bottom workout-bar can be hidden (its CTA now lives in the context panel) — guard
  so mobile keeps the bottom bar exactly as-is.

Below 900px: grid collapses to one column in current DOM order → identical to today.

## Phasing (narrow, reversible, each ships green)
- **PR1 — layout scaffold only.** Introduce the desktop grid + reflow EXISTING content into
  rail/center/context. No restyle, no logic change. Mobile byte-identical. Reversible in one revert.
- **PR2 — context "Today's session" panel.** Promote today's exercises + CTA into the right panel;
  hide the bottom workout-bar on desktop (mobile keeps it). Verify start/finish still works.
- **PR3 — craft pass (B).** (a) Type: tabular-nums on all numerals, tighten heading tracking,
  tuned scale; consider ONE self-hosted variable grotesk (offline-safe) — default to system stack
  first, zero-risk. (b) Calendar ring language: collapse the 5 competing styles to ONE coherent
  tonal-gold system (done = soft gold disc, today = solid gold, recovery = gold outline,
  rest/weekend = dim, planned = keep dashed-gold — it's semantic). Retire green + emoji flame
  (→ icon) + dot row (→ segmented week meter). (c) Backdrop: refine vignette + faint brand glow.

## After trainee A+B
The same grid primitives feed the **2-column coach console** (the already-planned next track,
project_desktop_framing memory): sidebar (trainee list) + main panel. Build trainee first, reuse.

## Files in play (from live audit)
- `v2-app/src/App.svelte` — `.app-shell` (radial desk already added), `.workout-bar` (hide on desktop in PR2).
- `v2-app/src/components/MainView.svelte` — `.main` (panel + desktop grid lives here).
- `v2-app/src/components/TopBar.svelte` — keep full-width; maybe move brand into rail later.
- `v2-app/src/components/StreakStrip.svelte` — compact rail variant + craft (flame→icon, dots→meter).
- `v2-app/src/components/MonthCalendar.svelte` — calendar ring-language craft pass (PR3).
