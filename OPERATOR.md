# OPERATOR.md — Survival & Continuity Handbook

**Purpose of this file:** everything a human needs to keep Timo Training alive **without any AI assistant**.
If AI tooling becomes unavailable overnight (regulatory shutdown, account loss, provider outage),
this is the single document that lets you — or any developer you hand the repo to — build, deploy,
restore, and operate the app by hand. It assumes only standard developer skills, no Claude, no Cowork.

Keep this file accurate. It is the AI-independence layer. Deep architecture lives in `AGENT.md`;
this file is the operational floor beneath it.

Last reviewed: 2026-06-13.

---

## 1. 60-second reality check

- **The app does NOT use any LLM/AI at runtime.** It is a static frontend + a Postgres-backed
  cloud sync. Shut down every AI model on earth and the app keeps working exactly as-is.
- The only real AI dependency is **development** (changes have been authored with AI help).
  That dependency is removed by this handbook: the stack is standard Svelte 5 + TypeScript + Vite,
  buildable and deployable by hand.
- The things that *would* actually take the app down are **infrastructure**, not AI:
  GitHub (hosting + CI), Supabase (auth + data), the domain/DNS at Zone.ee. Those are covered below.

---

## 2. Where everything lives

| Thing | Location |
|-------|----------|
| Source repo | `github.com/timo-anis/training-app` (branch `main`) |
| App source | `v2-app/src/` (Svelte 5 + TS) |
| Build output | `v2-dist/` (gitignored — generated) |
| Live site | https://trainingapp.timoanis.com/ |
| Hosting | GitHub Pages, served from `gh-pages` branch (root) |
| CI/CD | GitHub Actions — `.github/workflows/deploy.yml` |
| Database + Auth | Supabase project `krpbqzhttgelrbhkohct` (eu-west-1, FREE plan) |
| DNS | Zone.ee — CNAME `trainingapp.timoanis.com` → `timo-anis.github.io` |
| Data backups | `Timo training logbook/backups/app_state_<date>.json` |
| Code backups | `Timo training logbook/backups/code/training-app-<date>.bundle` |

**Accounts you must retain control of (single points of failure):**
GitHub (timo-anis), Supabase, the timoanis.com domain registrar, and Zone.ee DNS.
Losing any one of these is a bigger risk than losing AI access. Keep recovery codes / 2FA backups offline.

---

## 3. Run it locally (no AI, no CI)

```bash
cd v2-app
npm install
cp .env.example .env        # then fill in the two values below
npm run dev                 # local dev server
```

`.env` needs (from Supabase dashboard → Project Settings → API):

```
VITE_SUPABASE_URL=https://krpbqzhttgelrbhkohct.supabase.co
VITE_SUPABASE_KEY=<anon / publishable key — safe to expose in client>
```

The anon key is a client key and is safe in the browser; RLS protects the data (see §6).

---

## 4. Build & deploy by hand (if CI / GitHub Actions is gone)

Normal path: push to `main` → GitHub Actions runs `test → check → build → deploy to gh-pages`.

Manual fallback (no CI), deploying straight to the `gh-pages` branch:

```bash
cd v2-app
npm ci
npm test                    # ~159 tests — all must pass
npm run check               # TypeScript + Svelte check
npm run build               # outputs to ../v2-dist/
                            # build needs VITE_SUPABASE_URL / VITE_SUPABASE_KEY in env or .env

cd ..
# publish v2-dist/ to the gh-pages branch root:
npx gh-pages -d v2-dist -b gh-pages   # or: copy v2-dist/* onto a gh-pages checkout, commit, push
```

**Custom domain note:** GitHub Pages must keep the `CNAME` file (`trainingapp.timoanis.com`)
at the published root, or the custom domain breaks. `public/CNAME` carries it into the build.

**If GitHub Pages itself disappears:** the build in `v2-dist/` is plain static files
(HTML/JS/CSS/icons). Host it on any static host (Netlify, Cloudflare Pages, S3, nginx).
Then repoint the Zone.ee DNS record at the new host. No code change required.

---

## 5. Sandbox build caveat (important)

A local `vite build` inside an ephemeral sandbox has returned a **stale phantom bundle**.
Do **not** trust a sandbox build as proof of correctness. Trust instead:
`npm run check` + `npm test` passing, and the **GitHub Actions (Ubuntu) build**, which is authoritative.

---

## 6. Data model & database (the irreplaceable asset)

User workout data is the only thing that can't be rebuilt from source. Protect it first.

**Schema 4.1** (full types in `v2-app/src/types/workout.ts` — single source of truth):

```
AppState { schema:'4.0'|'4.1', weeks: WorkoutDay[], userStartWeek? }  // parser upgrades 4.0→4.1
WorkoutDay { week, day, date (ISO 'YYYY-MM-DD'), exercises[], completed?, note?, kind? }
Exercise   { id, name, type:'single'|'superset', code (A/B…), sets[], rest, note,
             recovery, recoveryDone, conditioning, conditioningNote, conditioningDone }
WorkoutSet { kg, reps, done, rpe }   // rpe: RIR-based RPE 6–10, '' = unrated (added 4.1)
```

Non-negotiable integrity rules (also in PROJECT_INSTRUCTIONS): never mix weekday/date,
never break superset structure, never reorder exercises, never drop `done` or `rpe` states.

**Supabase tables:** `app_state`, `app_state_history`, `profiles`, `app_errors`.
**Security layer:** Row Level Security — each user can only touch their own row.
Full recreate script: `supabase_rls.sql` (run against a fresh project after creating the tables).

**Storage model:** local-first. The app writes to `localStorage` on every change and syncs to
Supabase with a 3s debounce; on boot, local vs cloud is merged by timestamp (newer wins).
Practical consequence: a logged-in device holds a complete copy of the data in `localStorage`
even if Supabase is down.

---

## 7. Backups & restore

**Data backup** — scheduled task writes `app_state_<date>.json` into
`Timo training logbook/backups/` (keeps recent copies). These are plain JSON and open without
Supabase. **Restore:** paste the JSON back into the `app_state` row for the user, or load it into
`localStorage` under the app's state key and let it sync up.

> ⚠️ Verify this is actually running: as of 2026-06-13 only one dated JSON was present in
> `backups/`. A backup you haven't restored-tested is a hope, not a backup. Periodically:
> download the JSON, confirm it parses, confirm week/exercise counts look right.

**Code backup** — scheduled task creates a git bundle
`training-app-<date>.bundle` in `backups/code/` (daily, keeps ~7).
**Restore the entire codebase from a bundle (no GitHub needed):**

```bash
git clone training-app-<date>.bundle training-app
cd training-app/v2-app && npm install && npm run build
```

This means the full project survives even if GitHub deletes the account.

**Recommended belt-and-braces:** keep one copy of the latest code bundle **and** the latest
data JSON somewhere off these systems (personal drive / external disk). Two providers, one offline.

---

## 8. If a specific dependency disappears — continuity plays

- **AI / Claude access lost (the Fable/Mythos-style scenario):** nothing breaks. App runs, builds,
  deploys via §4. Author future changes by hand or with any other tooling. The codebase is standard.
- **GitHub Pages gone:** rebuild (§4), host the static `v2-dist/` anywhere, repoint DNS (§2).
- **GitHub account gone:** restore code from a bundle (§7), push to a new remote/host.
- **Supabase gone:** stand up any Postgres + an auth layer, recreate tables, run `supabase_rls.sql`,
  load the latest data JSON, update the two `VITE_SUPABASE_*` values, rebuild. Until then,
  logged-in devices keep working offline from `localStorage`.
- **Domain/DNS lost:** the app also resolves via the GitHub Pages origin; re-add the custom domain
  once DNS is restored.

Design rule to keep this true: **never put an AI call, or any single-provider dependency, in the
critical path of logging a workout.** Any future AI feature must be an optional layer that degrades
gracefully — the app must be fully usable with it switched off.

---

## 9. Credential hygiene

- The GitHub token used for automated pushes lives in `.git-credentials` in the logbook folder as
  plaintext. **Rotate it** to a fine-grained token scoped to only this repo's `contents: read/write`,
  and re-sync the file. Tooling reads the token at runtime, so rotation is safe.
- Keep 2FA/recovery codes for GitHub, Supabase, the domain registrar and Zone.ee **offline**.
  These accounts, not the code, are the true single points of failure.

---

## 10. Pointers

- `AGENT.md` — full architecture + development rules
- `CURRENT_BASELINE.md` — current feature state / code health
- `THEME_SYSTEM.md` — CSS token design system
- `PROJECT_INSTRUCTIONS.md` — data-integrity & patch-discipline rules
- `supabase_rls.sql` — full DB security layer (recreate script)
- `README.md` — quick overview
