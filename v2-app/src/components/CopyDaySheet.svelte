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
    dayLabel: string;
    dateLabel: string;
    dateISO: string;
    count: number;
    names: string[];
    haystack: string;
  }

  interface WeekGroup {
    week: number;        // absolute week number
    displayWeek: number; // week as shown to the user
    dateRange: string;
    days: Option[];
  }

  let selected: Option | null = null;
  let query = '';
  // Which weeks are expanded. Default: all collapsed (one row per week).
  let expanded: Record<number, boolean> = {};

  /** "15 Feb 2026" — empty string for a missing/invalid date. */
  function fmtDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** "24 Aug" — day + short month, no year, for compact week ranges. */
  function fmtShort(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  function rangeLabel(days: Option[]): string {
    const iso = days.map(d => d.dateISO).filter(Boolean).sort();
    if (iso.length === 0) return '';
    const lo = fmtShort(iso[0]);
    const hi = fmtShort(iso[iso.length - 1]);
    return lo === hi ? lo : `${lo} – ${hi}`;
  }

  // Every PAST day that has exercises (no cap), grouped by week. The current /
  // future days and empty days are excluded, matching the previous behaviour.
  $: options = (() => {
    const wo = $weekOffset;
    const result: Option[] = [];
    for (const wd of $appState.weeks) {
      if (wd.exercises.length === 0) continue;
      const isFuture = wd.week > week ||
        (wd.week === week && DAY_ORDER.indexOf(wd.day) >= DAY_ORDER.indexOf(day));
      if (isFuture) continue;
      const dateLabel = fmtDate(wd.date);
      const names = wd.exercises.map(e => e.name);
      result.push({
        srcWeek: wd.week,
        srcDay: wd.day,
        dayLabel: wd.day,
        dateLabel,
        dateISO: wd.date ?? '',
        count: wd.exercises.length,
        names,
        haystack: `week ${wd.week - wo} ${wd.day} ${dateLabel} ${names.join(' ')}`.toLowerCase(),
      });
    }
    return result;
  })();

  // Group into weeks (newest first); days inside a week run Monday → Sunday.
  $: groups = (() => {
    const wo = $weekOffset;
    const map = new Map<number, WeekGroup>();
    for (const o of options) {
      let g = map.get(o.srcWeek);
      if (!g) {
        g = { week: o.srcWeek, displayWeek: o.srcWeek - wo, dateRange: '', days: [] };
        map.set(o.srcWeek, g);
      }
      g.days.push(o);
    }
    const arr = [...map.values()];
    for (const g of arr) {
      g.days.sort((a, b) => DAY_ORDER.indexOf(a.srcDay) - DAY_ORDER.indexOf(b.srcDay));
      g.dateRange = rangeLabel(g.days);
    }
    arr.sort((a, b) => b.week - a.week);
    return arr;
  })();

  $: q = query.trim().toLowerCase();
  $: searching = q.length > 0;

  // While searching: keep only weeks with a matching day, and only the matching
  // days; every shown week is force-expanded so results are visible immediately.
  $: viewGroups = searching
    ? groups
        .map(g => ({ ...g, days: g.days.filter(d => d.haystack.includes(q)) }))
        .filter(g => g.days.length > 0)
    : groups;

  function toggle(w: number) {
    expanded = { ...expanded, [w]: !expanded[w] };
  }

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
      {#if viewGroups.length === 0}
        <div class="empty-msg">No days match “{query.trim()}”.</div>
      {:else}
        <div class="list" role="listbox" aria-label="Select a day to copy">
          {#each viewGroups as g (g.week)}
            {@const open = searching || expanded[g.week]}
            <div class="week-group">
              <button
                type="button"
                class="week-head"
                class:open
                on:click={() => toggle(g.week)}
                aria-expanded={open}
              >
                <span class="chevron" class:open aria-hidden="true">›</span>
                <span class="week-head-main">
                  <span class="week-title">Week {g.displayWeek}</span>
                  {#if g.dateRange}<span class="week-range">{g.dateRange}</span>{/if}
                </span>
                <span class="week-count">{g.days.length}</span>
              </button>

              {#if open}
                <div class="days">
                  {#each g.days as opt (opt.srcWeek + '-' + opt.srcDay)}
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
                        <span class="item-label">{opt.dayLabel}{#if opt.dateLabel}<span class="item-date">· {opt.dateLabel}</span>{/if}</span>
                        <span class="item-names">{opt.names.slice(0, 3).join(' · ')}{opt.names.length > 3 ? ` +${opt.names.length - 3}` : ''}</span>
                      </div>
                      <span class="item-count">{opt.count}</span>
                    </div>
                  {/each}
                </div>
              {/if}
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

  /* ── Week accordion header ── */
  .week-group {
    margin-bottom: 2px;
  }

  .week-head {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 12px;
    border-radius: 12px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    text-align: left;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .week-head:active { background: rgba(var(--c-fg), 0.06); }
  .week-head.open { background: rgba(var(--c-fg), 0.04); }

  .chevron {
    flex-shrink: 0;
    width: 16px;
    text-align: center;
    font-size: 18px;
    line-height: 1;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.45);
    transform: rotate(0deg);
    transition: transform 0.16s ease, color 0.12s;
  }

  .chevron.open {
    transform: rotate(90deg);
    color: var(--c-accent-solid);
  }

  .week-head-main {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .week-title {
    font-size: 14px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.92);
    letter-spacing: -0.01em;
  }

  .week-range {
    font-size: 12px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.38);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .week-count {
    font-size: 12px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.30);
    background: rgba(var(--c-fg), 0.06);
    border: 1px solid rgba(var(--c-fg), 0.08);
    border-radius: 999px;
    padding: 2px 9px;
    flex-shrink: 0;
  }

  .days {
    padding: 2px 0 6px 10px;
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

  .item-date {
    margin-left: 5px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.38);
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
