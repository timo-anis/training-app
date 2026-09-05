<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { appState, weekOffset } from '../stores/app';
  import { copyDayFrom } from '../stores/workout-state';
  import type { DayOfWeek } from '../types/workout';
  import { DAY_ORDER } from '../types/workout';

  export let week: number;
  export let day: DayOfWeek;

  const dispatch = createEventDispatcher<{ close: void }>();

  interface Option {
    srcWeek: number;
    srcDay: DayOfWeek;
    label: string;
    dateLabel: string;
    count: number;
    names: string[];
    haystack: string;
  }

  let selected: Option | null = null;
  let query = '';

  /** "15 Feb 2026" — empty string for a missing/invalid date. */
  function fmtDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Every PAST day that has exercises — no cap, so the full training history is
  // reachable (older weeks used to fall off a 30-item slice). The list scrolls;
  // the search box below narrows it by week number, weekday, month, or exercise.
  $: options = (() => {
    const wo = $weekOffset;
    const result: Option[] = [];
    for (const wd of $appState.weeks) {
      if (wd.exercises.length === 0) continue;
      const isFuture = wd.week > week ||
        (wd.week === week && DAY_ORDER.indexOf(wd.day) >= DAY_ORDER.indexOf(day));
      if (isFuture) continue;
      const label = `Week ${wd.week - wo} — ${wd.day}`;
      const dateLabel = fmtDate(wd.date);
      const names = wd.exercises.map(e => e.name);
      result.push({
        srcWeek: wd.week,
        srcDay: wd.day,
        label,
        dateLabel,
        count: wd.exercises.length,
        names,
        haystack: `${label} ${dateLabel} ${names.join(' ')}`.toLowerCase(),
      });
    }
    return result.sort((a, b) => {
      if (b.srcWeek !== a.srcWeek) return b.srcWeek - a.srcWeek;
      return DAY_ORDER.indexOf(b.srcDay) - DAY_ORDER.indexOf(a.srcDay);
    });
  })();

  $: q = query.trim().toLowerCase();
  $: filtered = q ? options.filter(o => o.haystack.includes(q)) : options;

  function confirm() {
    if (!selected) return;
    copyDayFrom(selected.srcWeek, selected.srcDay, week, day);
    dispatch('close');
  }

  function close() {
    dispatch('close');
  }

  function onBackdropKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="backdrop" on:click={close} on:keydown={onBackdropKey} role="presentation">
  <div class="sheet" on:click|stopPropagation role="dialog" aria-modal="true" aria-label="Copy day" tabindex="-1">
    <div class="handle" aria-hidden="true"></div>
    <div class="sheet-head">
      <span class="sheet-title">Copy from another day</span>
      <button class="close-btn" on:click={close} aria-label="Close">✕</button>
    </div>

    {#if options.length === 0}
      <div class="empty-msg">No past days with exercises found.</div>
    {:else}
      <div class="search-row">
        <input
          class="search-input"
          type="search"
          bind:value={query}
          placeholder="Search week, day, month or exercise…"
          aria-label="Search days to copy"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
        />
      </div>
      {#if filtered.length === 0}
        <div class="empty-msg">No days match “{query.trim()}”.</div>
      {:else}
        <div class="list" role="listbox" aria-label="Select a day to copy">
          {#each filtered as opt (opt.srcWeek + '-' + opt.srcDay)}
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <div
              class="item"
              class:selected={selected?.srcWeek === opt.srcWeek && selected?.srcDay === opt.srcDay}
              on:click={() => selected = opt}
              role="option"
              aria-selected={selected?.srcWeek === opt.srcWeek && selected?.srcDay === opt.srcDay}
              tabindex="0"
              on:keydown={(e) => e.key === 'Enter' && (selected = opt)}
            >
              <div class="item-main">
                <span class="item-label">{opt.label}{#if opt.dateLabel}<span class="item-date"> · {opt.dateLabel}</span>{/if}</span>
                <span class="item-names">{opt.names.slice(0, 3).join(' · ')}{opt.names.length > 3 ? ` +${opt.names.length - 3}` : ''}</span>
              </div>
              <span class="item-count">{opt.count}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <div class="sheet-footer">
      <button
        class="confirm-btn"
        on:click={confirm}
        disabled={!selected}
      >
        {selected ? `Copy ${selected.count} exercise${selected.count !== 1 ? 's' : ''}` : 'Select a day'}
      </button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(var(--c-bg-3-raw, 5, 8, 20), 0.65);
    z-index: 80;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fade-in 0.15s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .sheet {
    background: var(--c-bg-1);
    border: 1px solid rgba(var(--c-accent), 0.20);
    border-bottom: none;
    border-radius: 20px 20px 0 0;
    width: 100%;
    max-width: 640px;
    max-height: 72dvh;
    display: flex;
    flex-direction: column;
    animation: slide-up 0.22s cubic-bezier(0.32, 0.72, 0, 1);
  }

  @keyframes slide-up {
    from { transform: translateY(60px); opacity: 0.6; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .handle {
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: rgba(var(--c-fg), 0.18);
    margin: 12px auto 0;
    flex-shrink: 0;
  }

  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px 10px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(var(--c-accent), 0.14);
  }

  .sheet-title {
    font-size: 16px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.92);
    letter-spacing: -0.02em;
  }

  .close-btn {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid rgba(var(--c-fg), 0.10);
    background: transparent;
    color: rgba(var(--c-fg), 0.35);
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .close-btn:active { background: rgba(var(--c-fg), 0.08); }

  .search-row {
    padding: 10px 14px 4px;
    flex-shrink: 0;
  }

  .search-input {
    width: 100%;
    box-sizing: border-box;
    padding: 11px 13px;
    border-radius: 11px;
    border: 1px solid rgba(var(--c-fg), 0.12);
    background: rgba(var(--c-fg), 0.05);
    color: rgba(var(--c-fg), 0.92);
    font-size: 16px; /* >=16px: prevents iOS focus auto-zoom */
    font-weight: 600;
    letter-spacing: -0.01em;
    -webkit-appearance: none;
    appearance: none;
    -webkit-tap-highlight-color: transparent;
    transition: border-color 0.12s, background 0.12s;
  }

  .search-input::placeholder {
    color: rgba(var(--c-fg), 0.32);
    font-weight: 500;
  }

  .search-input:focus {
    outline: none;
    border-color: rgba(var(--c-accent), 0.45);
    background: rgba(var(--c-accent), 0.06);
  }

  .list {
    overflow-y: auto;
    flex: 1 1 auto;
    padding: 8px 12px;
    -webkit-overflow-scrolling: touch;
  }

  .item-date {
    font-weight: 600;
    color: rgba(var(--c-fg), 0.38);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 12px;
    border-radius: 12px;
    border: 1px solid transparent;
    margin-bottom: 4px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, border-color 0.12s;
  }

  .item:active {
    background: rgba(var(--c-accent), 0.08);
  }

  .item.selected {
    background: rgba(var(--c-accent), 0.10);
    border-color: rgba(var(--c-accent), 0.30);
  }

  .item-main {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .item-label {
    font-size: 14px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.92);
    letter-spacing: -0.01em;
  }

  .item.selected .item-label {
    color: var(--c-accent-solid);
  }

  .item-names {
    font-size: 12px;
    color: rgba(var(--c-fg), 0.35);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-count {
    font-size: 12px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.30);
    background: rgba(var(--c-fg), 0.06);
    border: 1px solid rgba(var(--c-fg), 0.08);
    border-radius: 999px;
    padding: 2px 9px;
    flex-shrink: 0;
  }

  .item.selected .item-count {
    color: var(--c-accent-solid);
    background: rgba(var(--c-accent), 0.12);
    border-color: rgba(var(--c-accent), 0.25);
  }

  .sheet-footer {
    padding: 10px 14px 20px;
    flex-shrink: 0;
    border-top: 1px solid rgba(var(--c-accent), 0.14);
  }

  .confirm-btn {
    width: 100%;
    padding: 15px;
    border-radius: 14px;
    border: 1px solid rgba(var(--c-accent), 0.45);
    background: rgba(var(--c-accent), 0.14);
    color: var(--c-accent-solid);
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.08s;
    letter-spacing: -0.01em;
  }

  .confirm-btn:not(:disabled):active {
    background: rgba(var(--c-accent), 0.24);
    transform: scale(0.98);
  }

  .confirm-btn:disabled {
    opacity: 0.35;
    cursor: default;
    border-color: rgba(var(--c-fg), 0.12);
    background: rgba(var(--c-fg), 0.04);
    color: rgba(var(--c-fg), 0.30);
  }

  .empty-msg {
    padding: 32px 20px;
    text-align: center;
    color: rgba(var(--c-fg), 0.28);
    font-size: 14px;
  }
</style>
