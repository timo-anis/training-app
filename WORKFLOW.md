# WORKFLOW.md — How work gets done in this project

> **Single source of truth for the working system.** Supersedes `PROJECT_INSTRUCTIONS_V2.md` and
> `TIMO_TRAINING_ITERATION_RULES_UPDATED.md` (archived in the logbook). `SESSION_KICKOFF.md` stays
> the operational on-ramp (access, traps, current state); `AGENT.md` stays the architecture
> reference. This file defines the **process**: how tasks are given, bounded, built, verified,
> and accepted.

---

## 1. How work is given: goal, not steps

Timo gives the **goal** and the **acceptance criteria**. The solution path is Claude's to choose.

A well-formed task has three parts:

1. **Goal** — what should be true when done (outcome, not implementation).
2. **Boundaries** — what must NOT change (see §2; defaults apply even if unstated).
3. **Definition of Done** — checkable criteria, not adjectives (see §3).

If Timo gives only a goal, Claude fills in 2 from the standing rules and **proposes 3 before
building**. If a task arrives as prescriptive steps, Claude may propose a better path — but the
boundaries and DoD still bind.

**Decision autonomy:** within the boundaries, Claude makes implementation decisions itself.
Ask only when (a) blocked, (b) the decision changes user-visible behavior in a way not covered
by the DoD, or (c) it touches a protected flow. Everything else: decide, note the decision in
the commit message, move on.

**Plan gate (L-tier only):** before building anything L-tier, Claude presents a short plan —
approach, files touched, DoD, risks, loop budget — and gets Timo's approval. **After approval,
the plan is the contract:** Claude executes it end-to-end without check-in questions, using the
autonomy rule above. Questions after approval are limited to genuine blockers. S/M work needs
no plan gate.

---

## 2. Boundaries (standing rules — apply to every task)

These hold no matter which solution path is chosen.

**Data integrity (non-negotiable):**
- Never mix weekdays and dates; week numbers stay consistent.
- Never break superset structure — `type` + `code` stay paired; supersets group by **first code letter**.
- Never reorder exercises unless explicitly asked.
- Never drop sets, reps, weights, or `done` states.
- Never silently normalize or migrate data. If unsure → preserve structure, then ask.

**Protected flows — do not touch unless the task explicitly targets them:**
Auth (sign in/out/session) · Boot (`bootstrapState`, BootOverlay) · Cloud sync (`saveCloud`, OCC) ·
Storage schema (localStorage keys, schema version) · Date/weekday alignment · Superset code
pairing & grouping · `lib/state-helpers.ts` pure functions · single-writer invariant (only the
trainee's client writes `app_state`).

**Scope discipline:**
- One bounded area per change. No drive-by fixes, no unrequested "small improvements".
- No renaming store fields, IDs, classes, or JS hooks without explicit reason.
- Every patch built from latest `origin/main`, narrow, reversible.
- App UI is **English-only**. No Estonian in any component.

**Stability beats elegance:** no uncontrolled rewrites. Runtime extraction follows
audit → readonly helper extraction → DI boundary → checkpoint → ownership migration, and the
protected runtime zones (focus/viewport, `finishWorkoutNow()`, wake lock, auth/boot/cloud
handoff, migration/integrity, timer & workout orchestration) stay centralized until separately
audited.

---

## 3. Definition of Done — measurable, never adjectives

"Better", "clean", "high quality" are not acceptance criteria. Every task gets a **checkable DoD**
before building starts.

**Standing baseline (every change, always):**
```
cd v2-app && npm run check   # 0 errors / 0 warnings
npx vitest run               # all tests pass (297+ as of c2923b6); new logic ⇒ new tests
npm run build                # clean two-entry build (index.html + coach.html)
```
Plus: data rules intact, protected flows untouched, workout-critical paths unbroken
(calendar selection, add/delete exercise, delete set, workout mode, finish workout, overlays,
auth, boot/cloud/loading).

**Task-specific DoD:** concrete, observable statements. Examples of the required form:
- "Tapping X opens Y in under 1s on mobile viewport 390px" — not "fast and smooth".
- "All 5 RLS assertions for role Z pass in the self-rollback matrix" — not "secure".
- "Streak pill shows 🔥N where N = consecutive fully-done days" — not "streak works".

**If no metric exists, creating the metric is step one of the task.** Claude proposes how the
result will be judged (test assertions, pixel/viewport checks, query results, timing bounds),
Timo confirms, then building starts. The metric outlives the task as a regression test where
possible.

---

## 4. Verification tiers — who checks, and how hard

Every task is classified before work starts. When in doubt, go one tier up.

| Tier | What it covers | Verification |
|------|----------------|--------------|
| **S** | Copy, styling, single-component tweaks, docs. No logic/state/data change. | Baseline gate (§3). Self-check against DoD. |
| **M** | Logic changes, new components, store changes, anything touching tests. | Baseline gate + **independent checker agent** (§5) with fresh context reviews the diff against DoD + §2 before push. |
| **L** | New features, schema/RLS changes, protected-flow work (when explicitly requested), multi-file refactors. | Full loop (§6): builder → checker → **adversarial agent** → fix → repeat. Progress page (§7) live throughout. RLS matrix mandatory before client code for any new table/policy. |

**The builder never grades its own work at M/L.** The builder defends its choices; a
fresh-context agent judges the result. Checker and adversarial agents get the DoD and the diff —
not the builder's reasoning or justifications.

---

## 5. Checker & adversarial agents — ready-to-use prompts

**Checker (M and L):**
> You are a reviewer with no stake in this code. Here is the Definition of Done: [DoD].
> Here is the diff: [diff]. Here are the standing boundaries: WORKFLOW.md §2.
> Verify each DoD item and each boundary independently. Do not trust claims in commit
> messages or comments — verify against the code. Report each item as PASS/FAIL with
> evidence (file:line). A single FAIL means the work returns to the builder.

**Adversarial (L only):**
> Your only task is to **prove this work does NOT meet the requirement**. DoD: [DoD].
> Try to break it: edge cases (empty day, 69-week blob, superset with 3+ exercises,
> offline mid-workout, stale SW bundle, concurrent coach+trainee session), data-rule
> violations (§2), regression on workout-critical paths. For each attack, report:
> what you tried, what happened, VULNERABLE or HELD. Finding nothing after a serious
> attempt is a valid result — but list the attacks tried, so the attempt is auditable.

Run these as separate sub-agent sessions (fresh context), not as a continuation of the builder's
conversation.

---

## 6. The loop — work ends at the bar, not at "done"

For L-tier work (and M-tier when the checker fails something):

```
1. BUILD    — implement against the DoD
2. CHECK    — checker agent verifies DoD + boundaries
3. ATTACK   — adversarial agent tries to break it (L only)
4. GAP      — identify the single biggest gap between result and bar
5. FIX      — close that gap only (no scope creep inside the loop)
6. REPEAT   — until checker reports all-PASS and adversarial reports all-HELD
```

**Work is not finished when the builder says finished. It is finished when the bar is met.**
Cap: if 3 full loops don't converge, stop and escalate to Timo with the remaining gap — that
signals a wrong-sized task or a wrong bar, not a need for loop 4.

**Multiple attempts (default for visual/UX and hard problems):** when the DoD has a
subjective-quality component (layout, visual design, interaction feel) or the first solution
is unlikely to be the best, run 2–3 independent builder attempts with the same DoD, let the
checker rank them, and carry the winner (or the best parts) into the next loop. Skipping this
for such work requires a stated reason in the plan.

**Split creative work by aspect (standing rule for creative/visual L-tier):** decompose into
independent aspects and give each to its own sub-agent — e.g. for a screen redesign: one agent
on layout/spacing, one on color/tokens (against `THEME_SYSTEM.md`), one on interaction states,
one on responsive behavior. Each gets only its aspect's DoD; an integrator session merges and
the checker verifies the whole against the full DoD.

**Parallel sessions:** split big work across sessions — one builds, one tests, one integrates
and walks the app as a user. Each session gets this file + the DoD as its contract. One session
= one track stays the norm (fresh chat per track).

---

## 7. Visible progress — PROGRESS.html

For every L-tier task, maintain `PROGRESS.html` in the logbook folder (template:
`PROGRESS_TEMPLATE.html`). Update it at every loop boundary (build done, check done, attack
done). It shows: goal + DoD checklist with live PASS/FAIL, loop counter, what changed this
loop, screenshots where UI is involved, open risks, and next step. Timo can open it any time
and see exactly where the work stands without reading the chat.

S/M tasks don't need it — commits and test output are the trail.

---

## 8. Reuse prior quality — don't start from zero

Before building anything new, look at the best prior equivalent in this repo and match its
level: pure helpers in `lib/` with unit tests (see `messages`, `freshness`), service-layer
data access (`services/coach.ts`), optimistic-mutation stores with revert
(`stores/messages.ts`), the 17-assertion self-rollback RLS matrix (T4), the Glass design
tokens (`THEME_SYSTEM.md`). The standing prompt: *"Look at the prior project, learn from the
solutions used, and apply the same level here."* New code that falls below the best existing
pattern is a checker FAIL.

---

## 9. Frictionless start — obstacles removed up front

Everything a session needs is pre-provisioned; don't go hunting and don't ask for what's
already granted:

- **Repo access:** `.git-setup.sh` + `.git-credentials` in the logbook folder. Clone fresh to
  a unique `/tmp` path (see SESSION_KICKOFF §3 for the ownership trap). Push directly to `main`;
  ignore the PR warning.
- **DB:** Supabase MCP (project `krpbqzhttgelrbhkohct`). Schema truth: `supabase_rls.sql`.
  Test trainee: `timoanis+test6@gmail.com`. **Never test against Timo's real blob.**
- **Budget/limits:** free-plan Supabase; no paid services without asking.
- **After push:** tell Timo to `git checkout main && git pull` on his Mac.
- **After every change:** update memory + repo docs without asking.

Ask a human only when blocked or when a decision crosses §1's autonomy line.

---

## 10. Session hygiene

Long, slow, or context-heavy conversation → stop, write a short handoff summary, continue in a
fresh chat in the same project. A degraded context produces degraded patches. New session
on-ramp: `MEMORY.md` (auto) → `SESSION_KICKOFF.md` → this file → relevant memory files.
