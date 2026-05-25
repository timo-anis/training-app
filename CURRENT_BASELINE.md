# Current Baseline

## Stable Baseline Summary

This repository currently uses the MVP1 `index.html` app as the active working baseline.

**Current file:** `index.html` — **8,442 lines** (as of 2026-05-25)

The current baseline is focused on:
- safe signed-in user isolation
- protected cloud persistence
- preserved workout data integrity
- clean behavior for real separate users in private beta

---

## CSS Architecture

The stylesheet is organized into a structured zone system. All zones are consolidated,
tested, and committed. Do not add new ITER/PHASE blocks — extend the relevant zone instead.

### Zone Map

| Zone | Scope | Lines (approx) |
|------|-------|---------------|
| Baseline | Root vars, resets, calendar, daycell, search-item, timer, radar, overlays | ~1,480 |
| Zone 5 | Calendar nav, search card, add-grid, exercise shell (display/flex/grid structure) | ~304 |
| Zone 2 | Layout & spacing system (topbar, metrics, layout columns, card padding) | ~119 |
| Zone 3 | Exercise cards, set rows, input states, ITER3-HOTFIX | ~403 |
| Zone 4 | Workout mode, timer overlay, active states, progress pills, nav | ~551 |
| Zone 7 | Radar / body card | ~346 |
| Zone 6 | Mobile spacing normalization | ~263 |
| Zone 8 | Workout + finish flow | ~505 |

### Protected — Do Not Touch

- `lock-overlay`, `lock-card`, `pin-*` (lines ~605–700)
- `auth-overlay`, `auth-card` (lines ~700–770)
- `boot-overlay`, `boot-card`, `@keyframes spin` (lines ~771–790)

These are security-critical overlays. Any change here requires explicit intent.

### Cascade Rules

- **Zone 2–8 win** over baseline by source order for non-`!important` properties
- **Layer 5 `!important` block** (lines ~1,060–1,480) wins over all zones for typography,
  brand sizing, and layout margins — zones cannot override these without `!important`
- **ITER3-HOTFIX** in Zone 3: `.exercise .setinput { background:#101828 !important }` —
  intentionally prevents green tint in is-done state. Do not remove.

---

## Confirmed Working Features

- Auth-first boot
- PIN screen no longer appears before auth
- User-scoped PIN
- Signed-in scoped workout state
- Signed-in scoped UI selection
- Primary workout data restored and cloud-backed
- Empty local state cannot overwrite populated cloud state
- Real separate users do not see primary workout data
- Non-primary empty users see a clean calendar without default markers
- Workout mode: progress pills horizontal, nav row, timer overlay, finish flow

---

## Important Data Safety Rules

- Never save empty state over populated cloud state
- Cloud is the source of truth for signed-in users
- Preserve all sets, reps, done states, supersets, and exercise order
- Do not delete localStorage or cloud data during migrations

---

## Testing Notes

- Gmail plus aliases are not valid multi-user tests
- Use a real separate email/account for multi-user testing
- After any CSS change: test full workout flow (start → add set → mark done → finish → calendar)

---

## Next Recommended Steps

- New user onboarding empty state
- Automatic backup before import/cloud overwrite
- Cleanup only after baseline is confirmed
