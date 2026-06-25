<script lang="ts">
  import type { Exercise, DayOfWeek } from '../../types/workout';
  import { emptyExercise, emptySet, DAY_ORDER } from '../../types/workout';
  import { appState, weekOffset, showToast } from '../../stores/app';
  import { assignments, assignmentKey, writeAssignment, removeAssignment } from '../../stores/assignments';
  import { searchExercises } from '../../data/exercises';

  // Coach authors a FUTURE prescribed day. Writes ONLY to coach_assignments
  // (never a blob). The trainee materializes it on first touch.
  // Identity (coachId/traineeId) is carried by the assignments store context,
  // set by CoachTraineeView before this renders. We only need the day anchor.
  export let week: number;
  export let day: DayOfWeek;

  // Local working copy. Re-seeded from the store whenever the day changes.
  let draft: Exercise[] = [];
  let loadedKey = '';
  $: key = assignmentKey(week, day);
  $: if (key !== loadedKey) {
    loadedKey = key;
    draft = clone($assignments[key]?.exercises ?? []);
  }

  const SUPER_CODES = ['', 'A', 'B', 'C', 'D'];

  function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

  function cleanForPlan(ex: Exercise): Exercise {
    return {
      ...clone(ex),
      id: `${ex.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      sets: (ex.sets.length ? ex.sets : [emptySet()]).map((s) => ({ kg: s.kg, reps: s.reps, done: false, rpe: '' })),
      recoveryDone: false,
      conditioningDone: false,
    };
  }

  async function persist() {
    try {
      if (draft.length === 0) await removeAssignment(week, day);
      else await writeAssignment(week, day, draft);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not save plan', 'error');
    }
  }

  // ---- mutations (local draft -> persist) ----
  function commit(next: Exercise[]) { draft = next; persist(); }

  // add exercise
  let adding = false;
  let addName = '';
  $: matches = addName.trim().length >= 1 ? searchExercises(addName.trim()).slice(0, 5) : [];
  function addExerciseNamed(name: string) {
    const n = name.trim();
    if (!n) return;
    const id = `${n.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    commit([...draft, emptyExercise(id, n)]);
    addName = '';
    adding = false;
  }

  // copy from one of the trainee's existing days (the "copy-week" workflow)
  let copying = false;
  $: copyOptions = (() => {
    const wo = $weekOffset;
    return $appState.weeks
      .filter((w) => w.exercises.length > 0)
      .map((w) => ({ week: w.week, day: w.day, label: `Week ${w.week - wo} — ${w.day}`, count: w.exercises.length, exercises: w.exercises }))
      .sort((a, b) => (b.week - a.week) || (DAY_ORDER.indexOf(b.day) - DAY_ORDER.indexOf(a.day)))
      .slice(0, 30);
  })();
  function copyFrom(exs: Exercise[]) {
    commit([...draft, ...exs.map(cleanForPlan)]);
    copying = false;
  }

  function removeExercise(i: number) { commit(draft.filter((_, idx) => idx !== i)); }
  function moveExercise(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  }
  function setCode(i: number, code: string) {
    const next = draft.map((ex, idx) => idx === i
      ? { ...ex, code, type: (code ? 'superset' : 'single') as Exercise['type'] }
      : ex);
    commit(next);
  }
  function addSet(i: number) {
    const next = draft.map((ex, idx) => {
      if (idx !== i) return ex;
      const last = ex.sets[ex.sets.length - 1];
      return { ...ex, sets: [...ex.sets, { kg: last?.kg ?? '', reps: last?.reps ?? '', done: false, rpe: '' }] };
    });
    commit(next);
  }
  function removeSet(i: number, si: number) {
    const next = draft.map((ex, idx) => idx === i ? { ...ex, sets: ex.sets.filter((_, k) => k !== si) } : ex);
    commit(next);
  }
  // update a set field locally (on input); persist on change/blur
  function setField(i: number, si: number, field: 'kg' | 'reps', value: string) {
    draft = draft.map((ex, idx) => idx === i
      ? { ...ex, sets: ex.sets.map((s, k) => k === si ? { ...s, [field]: value } : s) }
      : ex);
  }
  function setRest(i: number, value: string) {
    draft = draft.map((ex, idx) => idx === i ? { ...ex, rest: value } : ex);
  }

  async function clearPlan() {
    commit([]);
  }
</script>

<div class="ae">
  <div class="ae-head">
    <span class="ae-badge">PLAN · {day}, Week {week - $weekOffset}</span>
    {#if draft.length > 0}
      <button class="ae-clear" on:click={clearPlan}>Remove plan</button>
    {/if}
  </div>

  {#if draft.length === 0}
    <p class="ae-empty">No plan yet for this day. Add exercises or copy a previous day.</p>
  {:else}
    <div class="ae-list">
      {#each draft as ex, i (ex.id)}
        <div class="ae-ex">
          <div class="ae-ex-head">
            <select class="ae-code" value={ex.code} on:change={(e) => setCode(i, (e.target as HTMLSelectElement).value)} aria-label="Superset group">
              {#each SUPER_CODES as c}<option value={c}>{c || '—'}</option>{/each}
            </select>
            <span class="ae-name">{ex.name}</span>
            <div class="ae-ex-actions">
              <button class="ae-mini" on:click={() => moveExercise(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
              <button class="ae-mini" on:click={() => moveExercise(i, 1)} disabled={i === draft.length - 1} aria-label="Move down">↓</button>
              <button class="ae-mini danger" on:click={() => removeExercise(i)} aria-label="Remove exercise">✕</button>
            </div>
          </div>

          <div class="ae-sets">
            {#each ex.sets as s, si (si)}
              <div class="ae-set">
                <span class="ae-set-n">{si + 1}</span>
                <input class="ae-num" type="text" inputmode="decimal" placeholder="kg"
                  value={s.kg} on:input={(e) => setField(i, si, 'kg', (e.target as HTMLInputElement).value)} on:change={persist} />
                <span class="ae-x">×</span>
                <input class="ae-num" type="text" inputmode="numeric" placeholder="reps"
                  value={s.reps} on:input={(e) => setField(i, si, 'reps', (e.target as HTMLInputElement).value)} on:change={persist} />
                <button class="ae-mini danger" on:click={() => removeSet(i, si)} disabled={ex.sets.length <= 1} aria-label="Remove set">−</button>
              </div>
            {/each}
            <div class="ae-set-foot">
              <button class="ae-addset" on:click={() => addSet(i)}>+ set</button>
              <label class="ae-rest">
                rest
                <input class="ae-num sm" type="text" inputmode="numeric" placeholder="s"
                  value={ex.rest} on:input={(e) => setRest(i, (e.target as HTMLInputElement).value)} on:change={persist} />
              </label>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Tools -->
  <div class="ae-tools">
    {#if adding}
      <div class="ae-add">
        <input class="ae-add-input" placeholder="Exercise name…" bind:value={addName} autocomplete="off"
          on:keydown={(e) => { if (e.key === 'Enter') addExerciseNamed(addName); if (e.key === 'Escape') { adding = false; addName=''; } }} />
        {#if matches.length}
          <div class="ae-sugg">
            {#each matches as m}<button class="ae-sugg-item" on:click={() => addExerciseNamed(m.name)}>{m.name}</button>{/each}
          </div>
        {/if}
        <div class="ae-add-actions">
          <button class="ae-btn ghost" on:click={() => { adding = false; addName=''; }}>Cancel</button>
          <button class="ae-btn" on:click={() => addExerciseNamed(addName)} disabled={!addName.trim()}>Add</button>
        </div>
      </div>
    {:else if copying}
      <div class="ae-copy">
        {#if copyOptions.length === 0}
          <p class="ae-empty">No past days to copy from yet.</p>
        {:else}
          <div class="ae-copy-list">
            {#each copyOptions as opt}
              <button class="ae-copy-item" on:click={() => copyFrom(opt.exercises)}>
                <span class="ae-copy-label">{opt.label}</span>
                <span class="ae-copy-count">{opt.count}</span>
              </button>
            {/each}
          </div>
        {/if}
        <button class="ae-btn ghost full" on:click={() => copying = false}>Done</button>
      </div>
    {:else}
      <div class="ae-tool-row">
        <button class="ae-btn ghost" on:click={() => { adding = true; addName=''; }}>+ Add exercise</button>
        <button class="ae-btn ghost" on:click={() => copying = true}>Copy a day →</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .ae {
    margin-top: 10px; padding: 14px;
    border-radius: 18px;
    border: 1px solid rgba(var(--c-accent), 0.38);
    background: rgba(var(--c-accent), 0.05);
    display: grid; gap: 12px;
  }
  .ae-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .ae-badge {
    font-size: 11px; font-weight: 900; letter-spacing: 0.10em; color: var(--c-accent-solid);
    padding: 3px 10px; border-radius: 999px;
    background: rgba(var(--c-accent), 0.14); border: 1px solid rgba(var(--c-accent), 0.40);
  }
  .ae-clear {
    font-size: 12px; font-weight: 800; color: var(--h-ff8585, #ff8585);
    background: transparent; border: none; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .ae-empty { font-size: 13px; color: rgba(var(--c-fg), 0.50); text-align: center; padding: 10px 4px; margin: 0; }

  .ae-list { display: grid; gap: 10px; }
  .ae-ex {
    border-radius: 13px; border: 1px solid rgba(var(--c-fg), 0.10);
    background: rgba(var(--c-fg), 0.03); padding: 10px 11px; display: grid; gap: 8px;
  }
  .ae-ex-head { display: flex; align-items: center; gap: 8px; }
  .ae-code {
    flex: 0 0 auto; width: 48px; padding: 5px 6px; border-radius: 8px;
    background: rgba(var(--c-surface-c), 0.65); border: 1px solid rgba(var(--c-edge-d), 0.20);
    color: var(--c-text); font-size: 13px; font-weight: 800;
  }
  .ae-name { flex: 1 1 auto; min-width: 0; font-size: 14px; font-weight: 800; color: var(--c-text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ae-ex-actions { flex: 0 0 auto; display: flex; gap: 4px; }
  .ae-mini {
    width: 28px; height: 28px; border-radius: 7px;
    border: 1px solid rgba(var(--c-fg), 0.10); background: rgba(var(--c-fg), 0.04);
    color: rgba(var(--c-fg), 0.60); font-size: 13px; font-weight: 800; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ae-mini:disabled { opacity: 0.30; cursor: default; }
  .ae-mini.danger { color: var(--h-ff8585, #ff8585); }

  .ae-sets { display: grid; gap: 5px; }
  .ae-set { display: flex; align-items: center; gap: 6px; }
  .ae-set-n { flex: 0 0 auto; width: 16px; text-align: center; font-size: 11px; font-weight: 800; color: rgba(var(--c-fg), 0.35); }
  .ae-num {
    flex: 1 1 0; min-width: 0; width: 100%; padding: 8px 10px; border-radius: 9px;
    background: rgba(var(--c-surface-c), 0.65); border: 1px solid rgba(var(--c-edge-d), 0.18);
    color: var(--h-e8f2ff); font-size: 15px; font-weight: 700; outline: none; text-align: center;
  }
  .ae-num.sm { flex: 0 0 56px; width: 56px; }
  .ae-num::placeholder { color: rgba(var(--c-fg), 0.25); }
  .ae-x { flex: 0 0 auto; font-size: 13px; color: rgba(var(--c-fg), 0.35); }
  .ae-set-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; }
  .ae-addset {
    font-size: 12px; font-weight: 800; color: rgba(var(--c-fg), 0.60);
    background: transparent; border: 1px dashed rgba(var(--c-fg), 0.18); border-radius: 8px;
    padding: 6px 12px; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .ae-rest { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: rgba(var(--c-fg), 0.40); }

  .ae-tools { display: grid; gap: 8px; }
  .ae-tool-row { display: flex; gap: 8px; }
  .ae-btn {
    flex: 1 1 0; padding: 11px; border-radius: 11px;
    border: 1px solid rgba(var(--c-accent), 0.45); background: rgba(var(--c-accent), 0.14);
    color: var(--c-accent-solid); font-size: 13px; font-weight: 800; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .ae-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ae-btn.ghost { background: rgba(var(--c-fg), 0.04); border-color: rgba(var(--c-fg), 0.12); color: rgba(var(--c-fg), 0.70); }
  .ae-btn.full { width: 100%; }

  .ae-add, .ae-copy { display: grid; gap: 8px; }
  .ae-add-input {
    width: 100%; padding: 11px 13px; border-radius: 11px;
    background: rgba(var(--c-surface-c), 0.65); border: 1px solid rgba(var(--c-edge-d), 0.20);
    color: var(--h-e8f2ff); font-size: 16px; font-weight: 700; outline: none; box-sizing: border-box;
  }
  .ae-sugg { display: grid; gap: 4px; }
  .ae-sugg-item {
    text-align: left; padding: 9px 12px; border-radius: 9px;
    border: 1px solid rgba(var(--c-fg), 0.08); background: rgba(var(--c-fg), 0.04);
    color: rgba(var(--c-fg), 0.80); font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .ae-add-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ae-copy-list { display: grid; gap: 5px; max-height: 240px; overflow-y: auto; }
  .ae-copy-item {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 11px 13px; border-radius: 10px;
    border: 1px solid rgba(var(--c-fg), 0.08); background: rgba(var(--c-fg), 0.04);
    color: var(--c-text); font-size: 13px; font-weight: 700; cursor: pointer; -webkit-tap-highlight-color: transparent;
  }
  .ae-copy-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ae-copy-count {
    flex: 0 0 auto; font-size: 12px; font-weight: 800; color: rgba(var(--c-fg), 0.40);
    background: rgba(var(--c-fg), 0.06); border-radius: 999px; padding: 2px 9px;
  }
</style>
