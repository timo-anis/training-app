<script lang="ts">
  import { appState, updateUI, searchOpen, weekOffset } from '../stores/app';
  import { DAY_ORDER } from '../types/workout';
  import { PS_UTC } from '../lib/program';

  function close() { $searchOpen = false; }

  function weekDayToDate(week: number, day: string): Date {
    const dayIdx = DAY_ORDER.indexOf(day as any);
    const utc = PS_UTC + ((week - 1) * 7 + dayIdx) * 86400000;
    const d = new Date(utc);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAY_SHORT: Record<string, string> = {
    Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed',
    Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  };

  function fmtDate(week: number, day: string): string {
    const d = weekDayToDate(week, day);
    return `${DAY_SHORT[day] ?? day}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  }

  interface SearchResult {
    week: number;
    day: string;
    exName: string;
    dateLabel: string;
    lastKg: string;
    lastReps: string;
    setCount: number;
    completed: boolean;
  }

  let query = '';
  let inputEl: HTMLInputElement;

  $: trimmed = query.trim().toLowerCase();

  $: results = (() => {
    if (!trimmed || trimmed.length < 2) return [];
    const out: SearchResult[] = [];
    // Collect all matching exercise occurrences
    for (const wd of $appState.weeks) {
      for (const ex of wd.exercises) {
        if (!ex.name.toLowerCase().includes(trimmed)) continue;
        const doneSets = ex.sets.filter(s => s.done || s.kg || s.reps);
        const lastSet = doneSets[doneSets.length - 1] ?? null;
        out.push({
          week: wd.week,
          day: wd.day,
          exName: ex.name,
          dateLabel: fmtDate(wd.week, wd.day),
          lastKg: lastSet?.kg ?? '',
          lastReps: lastSet?.reps ?? '',
          setCount: doneSets.length,
          completed: wd.completed === true,
        });
      }
    }
    // Sort newest first (highest week/day)
    out.sort((a, b) => {
      if (b.week !== a.week) return b.week - a.week;
      return DAY_ORDER.indexOf(b.day as any) - DAY_ORDER.indexOf(a.day as any);
    });
    return out;
  })();

  function openDay(week: number, day: string, exName: string) {
    updateUI(ui => ({ ...ui, week, day: day as any, highlightExercise: exName }));
    close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  // Focus input on mount
  import { onMount } from 'svelte';
  onMount(() => {
    setTimeout(() => inputEl?.focus(), 60);
  });
</script>

<!-- Backdrop -->
<div class="backdrop" on:click={close} aria-hidden="true"></div>

<!-- Panel -->
<div class="search-overlay" role="dialog" aria-label="Search exercises">
  <div class="search-header">
    <div class="search-input-wrap">
      <span class="search-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="9" r="6"/>
          <line x1="14.5" y1="14.5" x2="19" y2="19"/>
        </svg>
      </span>
      <input
        bind:this={inputEl}
        class="search-input"
        type="text"
        placeholder="Search exercise history…"
        bind:value={query}
        on:keydown={onKeydown}
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
      />
      {#if query}
        <button class="clear-btn" on:click={() => { query = ''; inputEl?.focus(); }} aria-label="Clear">✕</button>
      {/if}
    </div>
    <button class="close-btn" on:click={close}>Cancel</button>
  </div>

  <div class="results-area">
    {#if trimmed.length < 2}
      <div class="hint">Type at least 2 characters to search your training history</div>

    {:else if results.length === 0}
      <div class="empty">No results for <strong>"{query}"</strong></div>

    {:else}
      <div class="results-count">{results.length} result{results.length !== 1 ? 's' : ''}</div>
      <div class="results-list">
        {#each results as r}
          <button class="result-item" on:click={() => openDay(r.week, r.day, r.exName)}>
            <div class="result-main">
              <span class="result-name">{r.exName}</span>
              {#if r.completed}
                <span class="result-done">✓</span>
              {/if}
            </div>
            <div class="result-meta">
              <span class="result-date">{r.dateLabel} · W{$weekOffset ? r.week - $weekOffset : r.week}</span>
              {#if r.setCount > 0}
                <span class="result-sets">
                  {r.setCount} set{r.setCount !== 1 ? 's' : ''}
                  {#if r.lastKg || r.lastReps}
                    · {r.lastKg ? r.lastKg + ' kg' : '—'} × {r.lastReps || '—'}
                  {/if}
                </span>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Backdrop */
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(var(--c-black), 0.65);
    z-index: 90;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  /* Main panel — slides up from bottom */
  .search-overlay {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    height: 88dvh;
    max-height: 88dvh;
    background: linear-gradient(180deg, var(--h-0d1a2e) 0%, var(--h-080c18) 100%);
    border-top: 1px solid rgba(var(--c-blue-d), 0.20);
    border-radius: 22px 22px 0 0;
    z-index: 91;
    display: flex;
    flex-direction: column;
    animation: slide-up 0.22s cubic-bezier(0.32, 0.72, 0, 1) both;
  }

  @keyframes slide-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }

  /* ── Header ── */
  .search-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 14px 12px;
    border-bottom: 1px solid rgba(var(--c-w), 0.07);
    flex-shrink: 0;
  }

  .search-input-wrap {
    flex: 1 1 0;
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 12px;
    color: rgba(var(--c-w), 0.35);
    display: flex;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    background: rgba(var(--c-ink-c), 0.70);
    border: 1px solid rgba(var(--c-w), 0.10);
    border-radius: 12px;
    padding: 11px 36px 11px 38px;
    font-size: 16px;
    font-weight: 600;
    color: var(--h-e8f2ff);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.12s;
    -webkit-appearance: none;
  }

  .search-input::placeholder { color: rgba(var(--c-w), 0.22); }
  .search-input:focus { border-color: rgba(var(--c-w), 0.22); }

  .clear-btn {
    position: absolute;
    right: 10px;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: rgba(var(--c-w), 0.10);
    border-radius: 50%;
    color: rgba(var(--c-w), 0.55);
    font-size: 10px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .close-btn {
    flex-shrink: 0;
    padding: 8px 4px;
    border: none;
    background: transparent;
    color: rgba(var(--c-w), 0.45);
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }

  .close-btn:active { color: rgba(var(--c-w), 0.80); }

  /* ── Results area ── */
  .results-area {
    flex: 1 1 0;
    min-height: 0;        /* critical: allows flex child to shrink + scroll */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 12px 14px 32px;
  }

  .hint {
    text-align: center;
    padding: 32px 20px;
    font-size: 14px;
    color: rgba(var(--c-w), 0.25);
    font-weight: 500;
  }

  .empty {
    text-align: center;
    padding: 32px 20px;
    font-size: 14px;
    color: rgba(var(--c-w), 0.30);
    font-weight: 500;
  }

  .empty strong { color: rgba(var(--c-w), 0.55); font-weight: 700; }

  .results-count {
    font-size: 11px;
    font-weight: 700;
    color: rgba(var(--c-w), 0.25);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  .results-list {
    display: grid;
    gap: 6px;
  }

  /* Result item */
  .result-item {
    width: 100%;
    text-align: left;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1px solid rgba(var(--c-w), 0.07);
    background: rgba(var(--c-w), 0.03);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.1s, border-color 0.1s;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .result-item:active {
    background: rgba(var(--c-w), 0.07);
    border-color: rgba(var(--c-w), 0.15);
  }

  .result-main {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .result-name {
    font-size: 15px;
    font-weight: 700;
    color: rgba(var(--c-w), 0.88);
    letter-spacing: -0.01em;
    flex: 1 1 0;
  }

  .result-done {
    font-size: 12px;
    font-weight: 800;
    color: rgba(var(--c-w), 0.50);
    flex-shrink: 0;
  }

  .result-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .result-date {
    font-size: 12px;
    color: rgba(var(--c-w), 0.35);
    font-weight: 600;
  }

  .result-sets {
    font-size: 12px;
    color: rgba(var(--c-w), 0.30);
    font-weight: 500;
  }

  /* Desktop */
  @media (min-width: 640px) {
    .search-overlay {
      left: 50%;
      right: auto;
      width: 480px;
      bottom: auto;
      top: 50%;
      transform: translateX(-50%) translateY(-50%);
      border-radius: 22px;
      height: min(72vh, 600px);
      max-height: 72vh;
      animation: fade-scale 0.18s ease both;
    }

    @keyframes fade-scale {
      from { opacity: 0; transform: translateX(-50%) translateY(-50%) scale(0.96); }
      to   { opacity: 1; transform: translateX(-50%) translateY(-50%) scale(1); }
    }
  }
</style>
