<script lang="ts">
  // "vs plan" panel (coach-UX Track 2). Read-only comparison of the coach's
  // prescribed day against the trainee's actual log. Renders nothing without a
  // plan; collapsed by default to keep the day view clean on mobile.
  import type { Exercise } from '../../types/workout';
  import { diffPlanVsActual, type SetDiff } from '../../lib/plan-diff';

  export let planned: Exercise[] = [];
  export let actual: Exercise[] = [];

  let expanded = false;

  $: diff = diffPlanVsActual(planned, actual);

  $: summaryParts = diff ? buildSummary() : [];
  function buildSummary(): string[] {
    if (!diff) return [];
    const s = diff.summary;
    const parts: string[] = [];
    parts.push(`${s.exercisesDone}/${s.planned} planned done`);
    if (s.setsAsPrescribed > 0) parts.push(`${s.setsAsPrescribed} sets as prescribed`);
    if (s.setsChanged > 0) parts.push(`${s.setsChanged} changed`);
    if (s.setsMissing > 0) parts.push(`${s.setsMissing} missing`);
    if (s.setsExtra > 0) parts.push(`${s.setsExtra} extra`);
    if (s.skipped > 0) parts.push(`${s.skipped} skipped`);
    if (s.unplanned > 0) parts.push(`${s.unplanned} unplanned`);
    return parts;
  }

  function fmt(kg: string, reps: string): string {
    const k = (kg ?? '').trim();
    const r = (reps ?? '').trim();
    if (!k && !r) return '—';
    return `${k || '?'}×${r || '?'}`;
  }
  function setLabel(s: SetDiff): string {
    if (s.status === 'missing') return fmt(s.prescribed!.kg, s.prescribed!.reps);
    if (s.status === 'extra') return fmt(s.actual!.kg, s.actual!.reps);
    return `${fmt(s.prescribed!.kg, s.prescribed!.reps)} → ${fmt(s.actual!.kg, s.actual!.reps)}`;
  }
</script>

{#if diff}
  <div class="pva">
    <button class="pva-head" on:click={() => (expanded = !expanded)} aria-expanded={expanded}>
      <span class="pva-title">vs plan</span>
      <span class="pva-summary">{summaryParts.join(' · ')}</span>
      <span class="pva-chevron" class:open={expanded} aria-hidden="true">›</span>
    </button>

    {#if expanded}
      <div class="pva-body">
        {#each diff.exercises as e (e.key)}
          <div class="pva-ex">
            <div class="pva-ex-head">
              <span class="pva-ex-name">{e.name}</span>
              {#if e.status === 'skipped'}
                <span class="pva-badge skipped">skipped</span>
              {:else if e.status === 'unplanned'}
                <span class="pva-badge unplanned">unplanned</span>
              {:else if e.flagOnly}
                <span class="pva-badge" class:done={e.flagDone} class:notdone={!e.flagDone}>
                  {e.flagDone ? 'done' : 'not done'}
                </span>
              {:else if e.complete && e.deviations === 0}
                <span class="pva-badge done">as prescribed</span>
              {:else if e.complete}
                <span class="pva-badge changed">done · {e.deviations} changed</span>
              {:else}
                <span class="pva-badge notdone">{e.setsDoneCount}/{e.setsPlanned} sets done</span>
              {/if}
            </div>
            {#if !e.flagOnly && e.sets.length > 0 && e.status !== 'skipped'}
              <div class="pva-sets">
                {#each e.sets as s (s.index)}
                  <div class="pva-set" class:changed={s.status === 'changed'} class:missing={s.status === 'missing'} class:extra={s.status === 'extra'}>
                    <span class="pva-set-idx">S{s.index}</span>
                    <span class="pva-set-vals">{setLabel(s)}</span>
                    <span class="pva-set-meta">
                      {#if s.status === 'missing'}
                        not done
                      {:else if s.actual}
                        {s.actual.done ? '✓' : '·'}{#if s.actual.rpe}&nbsp;RPE {s.actual.rpe}{/if}
                      {/if}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .pva {
    margin-top: 10px;
    border: 1px solid rgba(var(--c-accent), 0.22);
    border-radius: 12px;
    background: rgba(var(--c-accent), 0.05);
    overflow: hidden;
  }
  .pva-head {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 10px 12px;
    border: none; background: transparent; cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    text-align: left;
  }
  .pva-title {
    flex: 0 0 auto;
    font-size: 11px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
    color: var(--c-accent-solid);
  }
  .pva-summary {
    flex: 1 1 auto; min-width: 0;
    font-size: 12px; font-weight: 600; color: rgba(var(--c-fg), 0.55);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pva-chevron {
    flex: 0 0 auto; color: rgba(var(--c-fg), 0.40);
    font-size: 16px; font-weight: 700; line-height: 1;
    transform: rotate(90deg); transition: transform 0.15s;
  }
  .pva-chevron.open { transform: rotate(-90deg); }

  .pva-body { padding: 2px 12px 12px; display: grid; gap: 10px; }
  .pva-ex { border-top: 1px dashed rgba(var(--c-fg), 0.10); padding-top: 8px; }
  .pva-ex-head { display: flex; align-items: center; gap: 8px; }
  .pva-ex-name {
    flex: 1 1 auto; min-width: 0;
    font-size: 13px; font-weight: 800; color: var(--c-text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pva-badge {
    flex: 0 0 auto;
    font-size: 10px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 2px 8px; border-radius: 999px;
    border: 1px solid rgba(var(--c-fg), 0.14); color: rgba(var(--c-fg), 0.55);
  }
  .pva-badge.done {
    color: var(--h-4fc08d, #4fc08d);
    border-color: rgba(79, 192, 141, 0.4);
  }
  .pva-badge.changed, .pva-badge.notdone {
    color: var(--h-d9a24a, #d9a24a);
    border-color: rgba(217, 162, 74, 0.4);
  }
  .pva-badge.skipped {
    color: var(--h-ff8585, #ff8585);
    border-color: rgba(255, 133, 133, 0.35);
  }
  .pva-badge.unplanned {
    color: rgba(var(--c-fg), 0.60);
    border-color: rgba(var(--c-fg), 0.20);
  }

  .pva-sets { display: grid; gap: 3px; margin-top: 6px; }
  .pva-set {
    display: flex; align-items: baseline; gap: 8px;
    font-size: 12px; font-weight: 600; color: rgba(var(--c-fg), 0.65);
  }
  .pva-set-idx { flex: 0 0 26px; font-size: 10px; font-weight: 800; color: rgba(var(--c-fg), 0.35); }
  .pva-set-vals { flex: 1 1 auto; font-variant-numeric: tabular-nums; }
  .pva-set-meta { flex: 0 0 auto; font-size: 11px; color: rgba(var(--c-fg), 0.45); }
  .pva-set.changed .pva-set-vals { color: var(--h-d9a24a, #d9a24a); }
  .pva-set.missing .pva-set-vals { color: var(--h-ff8585, #ff8585); text-decoration: line-through; opacity: 0.75; }
  .pva-set.extra .pva-set-vals { color: rgba(var(--c-fg), 0.80); }
  .pva-set.extra .pva-set-idx::after { content: "+"; }
</style>
