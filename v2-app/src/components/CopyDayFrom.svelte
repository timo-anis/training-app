<script lang="ts">
  import { appState, uiState, weekOffset, showToast } from '../stores/app';
  import { copyDayFrom } from '../stores/workout-state';
  import type { DayOfWeek } from '../types/workout';
  import { DAY_ORDER } from '../types/workout';

  export let week: number;
  export let day: DayOfWeek;

  let selectedValue = '';
  let preview = '';

  interface Option {
    value: string;
    label: string;
    srcWeek: number;
    srcDay: DayOfWeek;
    count: number;
    names: string[];
  }

  // Past days with exercises, newest first, max 28
  $: options = (() => {
    const wo = $weekOffset;
    const result: Option[] = [];
    for (const wd of $appState.weeks) {
      if (wd.exercises.length === 0) continue;
      // Skip current day and future days
      const isFuture = wd.week > week ||
        (wd.week === week && DAY_ORDER.indexOf(wd.day) >= DAY_ORDER.indexOf(day));
      if (isFuture) continue;
      result.push({
        value: `${wd.week}_${wd.day}`,
        label: `Week ${wd.week - wo} – ${wd.day}`,
        srcWeek: wd.week,
        srcDay: wd.day,
        count: wd.exercises.length,
        names: wd.exercises.map(e => e.name),
      });
    }
    return result
      .sort((a, b) => {
        if (b.srcWeek !== a.srcWeek) return b.srcWeek - a.srcWeek;
        return DAY_ORDER.indexOf(b.srcDay) - DAY_ORDER.indexOf(a.srcDay);
      })
      .slice(0, 28);
  })();

  // Reset selection when week/day changes
  $: { week; day; selectedValue = ''; preview = ''; }

  function onSelectChange() {
    if (!selectedValue) { preview = ''; return; }
    const opt = options.find(o => o.value === selectedValue);
    if (!opt) { preview = ''; return; }
    const shown = opt.names.slice(0, 3).join(', ');
    const extra = opt.names.length > 3 ? ` +${opt.names.length - 3}` : '';
    preview = `${opt.count} exercise${opt.count !== 1 ? 's' : ''}: ${shown}${extra}`;
  }

  function handleCopy() {
    if (!selectedValue) return;
    const opt = options.find(o => o.value === selectedValue);
    if (!opt) return;
    copyDayFrom(opt.srcWeek, opt.srcDay, week, day);
    showToast(`Copied ${opt.count} exercise${opt.count !== 1 ? 's' : ''} from ${opt.label}`, 'success');
    selectedValue = '';
    preview = '';
  }
</script>

{#if options.length > 0}
  <div class="copy-row">
    <select
      class="copy-select"
      bind:value={selectedValue}
      on:change={onSelectChange}
    >
      <option value="">— Copy full day from... —</option>
      {#each options as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
    <button
      class="copy-btn"
      on:click={handleCopy}
      disabled={!selectedValue}
    >Copy Day</button>
  </div>
  {#if preview}
    <div class="copy-preview">{preview}</div>
  {/if}
{/if}

<style>
  .copy-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    align-items: center;
    margin-top: 10px;
  }

  .copy-select {
    background: rgba(var(--c-surface-c), 0.65);
    border: 1px solid rgba(var(--c-edge-d), 0.20);
    border-radius: 12px;
    padding: 11px 14px;
    font-size: 13px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.65);
    outline: none;
    -webkit-appearance: none;
    width: 100%;
    cursor: pointer;
    transition: border-color 0.12s;
  }

  .copy-select:focus {
    border-color: rgba(var(--c-fg), 0.25);
  }

  .copy-btn {
    padding: 11px 16px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-fg), 0.16);
    background: rgba(var(--c-fg), 0.07);
    color: rgba(var(--c-fg), 0.80);
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .copy-btn:not(:disabled):active {
    background: rgba(var(--c-fg), 0.14);
  }

  .copy-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .copy-preview {
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.40);
    padding: 5px 4px 0;
  }
</style>
