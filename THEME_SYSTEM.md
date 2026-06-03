# Theme System — Timo Training V2

All colours in the app are CSS custom properties ("tokens") defined in
`v2-app/src/app.css`. Components never hardcode colours — they reference
`var(--token)`. There are two themes.

## Themes

| Theme | Selector | Purpose |
|-------|----------|---------|
| **dark** (default) | base `:root { … }` | The everyday app. Token defaults equal the exact pre-token colour values, so dark is pixel-identical to before the token migration. |
| **presentation** | `:root[data-theme="presentation"] { … }` | Light / high-contrast for demos on a projector. Overrides every token with a lighter, premium graphite-indigo palette. |

## How a theme is applied

- Store: `theme` writable in `stores/app.ts` (`'dark' | 'presentation'`), with `toggleTheme()`.
- Persisted to `localStorage` key `timo_training_theme`.
- Applied by setting `document.documentElement.dataset.theme` (→ `data-theme="dark|presentation"`).
- An inline script in `index.html` `<head>` reads localStorage and sets `data-theme` **before paint**, so there is no theme flash on boot.
- **Access control:** `canUsePresentation` (derived from `currentUser`, allow-list in `stores/app.ts`) gates the toggle. Any signed-in user not on the list is forced to dark.

## Token naming

Two families:

1. **Semantic core tokens** — the colours you reach for most. Names describe the
   *role*, not the colour (the value flips between dark and presentation):
   - `--c-fg` neutral foreground / overlay (light-on-dark, dark-on-light)
   - `--c-accent` accent tint base · `--c-accent-solid` solid accent fill
   - `--c-shadow` shadows · `--c-text` primary text
   - `--c-edge-a..e` tinted borders / glows · `--c-surface-a..c` glass surfaces
   - `--c-bg-1..3` app-background gradient stops

   The alpha-family ones are used as `rgba(var(--c-fg), <alpha>)` — one token
   carries the RGB, the alpha stays inline, so a single token covers every
   opacity variant.
2. **Per-literal tokens** — one per distinct one-off colour (left mechanical):
   - `--h-<hex>` e.g. `--h-ff6060` (solid hex colours)
   - `--c-<r>-<g>-<b>-<alpha>` e.g. `--c-255-80-80-0_18` (one-off rgba colours)

~123 tokens total (core renamed to semantic; long-tail one-offs kept literal).

## How to recolour

- **Change a colour everywhere:** edit the token value in `app.css` — do **not** touch components.
- **Add a new colour:** define the token in *both* the base `:root` and the `[data-theme="presentation"]` block, then reference `var(--…)` in the component.
- **Calendar day-type tiles** (workout=blue, recovery, rest=violet, done=green): the on-tile number/mark tokens (`--h-eafff5`, `--h-eaf1ff`, `--h-fff6e6`, `--h-f1eeff`, …) are kept **light** in presentation so dates stay legible on the saturated tiles. Transparent-cell numbers (weekend/future/neutral) use presentation-scoped rules in `MonthCalendar.svelte`.

## Invariants (do not break)

- Dark theme must stay pixel-identical: every base `:root` token equals its original literal.
- Presentation overrides only live in the `[data-theme="presentation"]` block (and a few presentation-scoped rules in `MonthCalendar.svelte`). They must never affect dark.
- Colours only — the theme system touches no logic, data, or flows.

## Known follow-ups

- Core tokens are now semantic (`--c-accent`, `--c-surface-*`, `--c-text`, …); the long-tail one-off literals (`--c-10-18-40-0_92`) are intentionally left mechanical.
- The presentation palette is partly heuristic; polish per-screen if a real demo reveals weak spots.
