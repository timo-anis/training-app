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
    count: number;
    names: string[];
  }

  let selected: Option | null = null;

  $: options = (() => {
    const wo = $weekOffset;
    const result: Option[] = [];
    for (const wd of $appState.weeks) {
      if (wd.exercises.length === 0) continue;
      const isFuture = wd.week > week ||
        (wd.week === week && DAY_ORDER.indexOf(wd.day) >= DAY_ORDER.indexOf(day));
      if (isFuture) continue;
      result.push({
        srcWeek: wd.week,
        srcDay: wd.day,
        label: `Week ${wd.week - wo} — ${wd.day}`,
        count: wd.exercises.length,
        names: wd.exercises.map(e => e.name),
      });
    }
    return result
      .sort((a, b) => {
        if (b.srcWeek !== a.srcWeek) return b.srcWeek - a.srcWeek;
        return DAY_ORDER.indexOf(b.srcDay) - DAY_ORDER.indexOf(a.srcDay);
      })
      .slice(0, 30);
  })();

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
  <div class="sheet" on:click|stopPropagation role="dialog" aria-modal="true" aria-label="Copy day">
    <div class="handle" aria-hidden="true"></div>
    <div class="sheet-head">
      <span class="sheet-title">Copy from another day</span>
      <button class="close-btn" on:click={close} aria-label="Close">✕</button>
    </div>

    {#if options.length === 0}
      <div class="empty-msg">No past days with exercises found.</div>
    {:else}
      <div class="list" role="listbox" aria-label="Select a day to copy">
        {#each options as opt}
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
              <span class="item-label">{opt.label}</span>
              <span class="item-names">{opt.names.slice(0, 3).join(' · ')}{opt.names.length > 3 ? ` +${opt.names.length - 3}` : ''}</span>
            </div>
            <span class="item-count">{opt.count}</span>
          </div>
        {/each}
      </div>
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
    background: rgba(5, 8, 20, 0.65);
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
    background: linear-gradient(180deg, #0f1d36 0%, #080e1e 100%);
    border: 1px solid rgba(60, 90, 165, 0.20);
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
    background: rgba(232, 240, 255, 0.18);
    margin: 12px auto 0;
    flex-shrink: 0;
  }

  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 18px 10px;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(60, 90, 165, 0.14);
  }

  .sheet-title {
    font-size: 16px;
    font-weight: 700;
    color: #e8f0ff;
    letter-spacing: -0.02em;
  }

  .close-btn {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid rgba(232, 240, 255, 0.10);
    background: transparent;
    color: rgba(232, 240, 255, 0.35);
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .close-btn:active { background: rgba(232, 240, 255, 0.08); }

  .list {
    overflow-y: auto;
    flex: 1 1 auto;
    padding: 8px 12px;
    -webkit-overflow-scrolling: touch;
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
    background: rgba(100, 155, 255, 0.08);
  }

  .item.selected {
    background: rgba(100, 155, 255, 0.10);
    border-color: rgba(100, 155, 255, 0.30);
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
    color: #e8f0ff;
    letter-spacing: -0.01em;
  }

  .item.selected .item-label {
    color: #9bc0ff;
  }

  .item-names {
    font-size: 12px;
    color: rgba(232, 240, 255, 0.35);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .item-count {
    font-size: 12px;
    font-weight: 700;
    color: rgba(232, 240, 255, 0.30);
    background: rgba(232, 240, 255, 0.06);
    border: 1px solid rgba(232, 240, 255, 0.08);
    border-radius: 999px;
    padding: 2px 9px;
    flex-shrink: 0;
  }

  .item.selected .item-count {
    color: #9bc0ff;
    background: rgba(100, 155, 255, 0.12);
    border-color: rgba(100, 155, 255, 0.25);
  }

  .sheet-footer {
    padding: 10px 14px 20px;
    flex-shrink: 0;
    border-top: 1px solid rgba(60, 90, 165, 0.14);
  }

  .confirm-btn {
    width: 100%;
    padding: 15px;
    border-radius: 14px;
    border: 1px solid rgba(196, 146, 46, 0.45);
    background: rgba(196, 146, 46, 0.14);
    color: #d4a038;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, transform 0.08s;
    letter-spacing: -0.01em;
  }

  .confirm-btn:not(:disabled):active {
    background: rgba(196, 146, 46, 0.24);
    transform: scale(0.98);
  }

  .confirm-btn:disabled {
    opacity: 0.35;
    cursor: default;
    border-color: rgba(232, 240, 255, 0.12);
    background: rgba(232, 240, 255, 0.04);
    color: rgba(232, 240, 255, 0.30);
  }

  .empty-msg {
    padding: 32px 20px;
    text-align: center;
    color: rgba(232, 240, 255, 0.28);
    font-size: 14px;
  }
</style>
