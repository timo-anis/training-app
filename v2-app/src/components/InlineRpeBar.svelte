<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let value: string = '';
  export let suggestion: number | null = null;
  export let onPick: (v: string) => void = () => {};
  export let onClear: () => void = () => {};
  export let readonly = false;
  export let big = false;

  const HINT_KEY = 'timo_rpe_bar_seen';
  const OPTIONS = ['6', '7', '8', '9', '10'];

  let showEdu = false;
  let hintVisible = false;
  let hintShowing = false;
  let hintTimer: ReturnType<typeof setTimeout>;
  let fadeTimer: ReturnType<typeof setTimeout>;

  $: rated = value !== '';
  // Map suggestion to nearest whole number for dashed highlight
  $: suggWhole = suggestion != null ? String(Math.round(suggestion)) : null;

  onMount(() => {
    if (readonly) return;
    try {
      if (!localStorage.getItem(HINT_KEY)) {
        localStorage.setItem(HINT_KEY, '1');
        hintShowing = true;
        // small delay so transition fires
        requestAnimationFrame(() => { hintVisible = true; });
        hintTimer = setTimeout(() => {
          hintVisible = false;
          fadeTimer = setTimeout(() => { hintShowing = false; }, 400);
        }, 3500);
      }
    } catch { /* ignore */ }
  });

  onDestroy(() => {
    clearTimeout(hintTimer);
    clearTimeout(fadeTimer);
  });

  function pick(v: string) {
    if (readonly) return;
    if (v === value) { onClear(); } else { onPick(v); }
  }
</script>

{#if readonly}
  {#if rated}
    <span class="rpe-ro">RPE {value}</span>
  {/if}
{:else}
  <div class="rpe-wrap" class:big>
    {#if hintShowing}
      <div class="rpe-hint" class:vis={hintVisible}>Rate how hard this set felt</div>
    {/if}
    <div class="rpe-bar">
      <span class="rpe-lbl">RPE</span>
      {#each OPTIONS as opt}
        <button
          type="button"
          class="rpe-btn"
          class:sel={value === opt}
          class:sugg={!rated && suggWhole === opt}
          on:click={() => pick(opt)}
          aria-label="RPE {opt}"
          aria-pressed={value === opt}
        >{opt}</button>
      {/each}
      <button type="button" class="rpe-skip" on:click={onClear} aria-label="Skip RPE rating">—</button>
      <button
        type="button"
        class="rpe-help"
        class:active={showEdu}
        on:click={() => showEdu = !showEdu}
        aria-label="What is RPE?"
        aria-expanded={showEdu}
      >?</button>
    </div>
    {#if showEdu}
      <div class="rpe-edu" role="note">
        <strong>RPE — Rate of Perceived Exertion</strong>
        Based on Reps In Reserve (RIR): how many reps you had left in the tank.
        <span class="edu-scale">
          <b>10</b> = nothing left &middot;
          <b>8</b> = 2 reps left &middot;
          <b>6</b> = 4+ reps left
        </span>
        Logging RPE tracks your true effort — not just weight — so you can spot fatigue early and train smarter.
      </div>
    {/if}
  </div>
{/if}

<style>
  .rpe-hint {
    font-size: 11px;
    color: rgba(var(--c-accent), 0.70);
    padding: 0 2px 5px;
    letter-spacing: 0.02em;
    opacity: 0;
    transition: opacity 0.35s;
  }
  .rpe-hint.vis { opacity: 1; }

  .rpe-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 7px;
    background: rgba(var(--c-surface-c), 0.30);
    border: 1px solid rgba(var(--c-edge-d), 0.18);
    border-radius: 10px;
  }
  .big .rpe-bar { padding: 7px 9px; gap: 5px; border-radius: 12px; }

  .rpe-lbl {
    font-size: 10px;
    font-weight: 800;
    color: rgba(var(--c-fg), 0.28);
    letter-spacing: 0.07em;
    flex-shrink: 0;
    margin-right: 1px;
    user-select: none;
  }
  .big .rpe-lbl { font-size: 11px; }

  .rpe-btn {
    flex: 1;
    height: 30px;
    min-width: 0;
    border-radius: 7px;
    border: 1px solid rgba(var(--c-edge-d), 0.20);
    background: rgba(var(--c-surface-b), 0.55);
    color: rgba(var(--c-fg), 0.60);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.10s, border-color 0.10s, color 0.10s;
  }
  .big .rpe-btn { height: 36px; font-size: 15px; border-radius: 8px; }
  .rpe-btn:active { transform: scale(0.93); }
  .rpe-btn.sel {
    background: rgba(var(--c-accent), 0.20);
    border-color: rgba(var(--c-accent), 0.52);
    color: var(--c-accent-solid);
  }
  .rpe-btn.sugg {
    border-style: dashed;
    border-color: rgba(var(--c-accent), 0.38);
    color: rgba(var(--c-accent), 0.55);
  }

  .rpe-skip {
    flex-shrink: 0;
    width: 26px;
    height: 30px;
    border-radius: 7px;
    border: 1px solid rgba(var(--c-fg), 0.10);
    background: transparent;
    color: rgba(var(--c-fg), 0.22);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
  }
  .big .rpe-skip { width: 30px; height: 36px; border-radius: 8px; font-size: 16px; }
  .rpe-skip:active { background: rgba(var(--c-fg), 0.07); }

  .rpe-help {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1px solid rgba(var(--c-fg), 0.14);
    background: rgba(var(--c-fg), 0.04);
    color: rgba(var(--c-fg), 0.40);
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.10s, border-color 0.10s;
  }
  .rpe-help.active {
    background: rgba(var(--c-accent), 0.12);
    border-color: rgba(var(--c-accent), 0.35);
    color: var(--c-accent-solid);
  }
  .big .rpe-help { width: 30px; height: 30px; font-size: 13px; }

  .rpe-edu {
    margin-top: 6px;
    padding: 10px 12px;
    background: rgba(var(--c-fg), 0.04);
    border: 1px solid rgba(var(--c-fg), 0.09);
    border-radius: 9px;
    font-size: 12px;
    line-height: 1.5;
    color: rgba(var(--c-fg), 0.58);
  }
  .rpe-edu strong {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.85);
    margin-bottom: 4px;
  }
  .edu-scale {
    display: block;
    margin: 5px 0;
    color: rgba(var(--c-fg), 0.48);
  }
  .rpe-edu b { color: var(--c-accent-solid); font-weight: 700; }

  .rpe-ro {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    color: var(--c-accent-solid);
    background: rgba(var(--c-accent), 0.11);
    border: 1px solid rgba(var(--c-accent), 0.28);
    border-radius: 6px;
    padding: 2px 7px;
  }
</style>
