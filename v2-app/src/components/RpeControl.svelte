<script lang="ts">
  import { RPE_OPTIONS } from '../lib/rpe';

  // Per-set RPE chip + scale picker. Presentational + self-contained:
  // the parent owns the value and persists via onPick / onClear.
  export let value: string = '';            // '' = not rated
  export let suggestion: number | null = null; // faint pre-fill, never auto-saved
  export let big = false;                   // workout mode → larger thumb targets
  export let onPick: (v: string) => void = () => {};
  export let onClear: () => void = () => {};

  const EDU_KEY = 'timo_rpe_edu_seen';

  let open = false;
  let showEdu = false;

  $: rated = value !== '';
  $: hasSuggestion = !rated && suggestion != null;

  function openPicker() {
    open = true;
    // Just-in-time education: auto-show once on first ever open.
    try {
      if (!localStorage.getItem(EDU_KEY)) {
        showEdu = true;
        localStorage.setItem(EDU_KEY, '1');
      }
    } catch { /* ignore */ }
  }

  function close() { open = false; showEdu = false; }

  function pick(v: string) { onPick(v); close(); }
  function clear() { onClear(); close(); }
</script>

<button
  type="button"
  class="rpe-chip"
  class:big
  class:rated
  class:suggest={hasSuggestion}
  on:click|stopPropagation={openPicker}
  aria-label={rated ? `RPE ${value}` : 'Set RPE'}
>
  {#if rated}
    <span class="rpe-num">{value}</span>
  {:else if hasSuggestion}
    <span class="rpe-num faint">≈{suggestion}</span>
  {:else}
    <span class="rpe-lbl">RPE</span>
  {/if}
</button>

{#if open}
  <div class="rpe-backdrop" on:click|stopPropagation={close} aria-hidden="true"></div>
  <div class="rpe-sheet" role="dialog" aria-modal="true" tabindex="-1" aria-label="Rate of perceived exertion">
    <div class="rpe-sheet-head">
      <span class="rpe-title">How hard did it feel?</span>
      <button type="button" class="rpe-help" on:click={() => showEdu = !showEdu} aria-label="What is RPE?">?</button>
    </div>

    {#if showEdu}
      <div class="rpe-edu">
        <strong>RPE — how hard did it feel?</strong>
        <p>RPE on the RIR (Reps In Reserve) scale measures how many reps you had left in the tank.</p>
        <p><b>10</b> = nothing left · <b>9</b> = 1 left · <b>8</b> = 2 left · <b>7</b> = 3 left · <b>6</b> = 4+ left.</p>
        <p>Logging it tracks your <em>true effort</em>, not just the weight — so you can train to a target effort and spot fatigue early.</p>
      </div>
    {/if}

    <div class="rpe-grid">
      {#each RPE_OPTIONS as opt}
        <button
          type="button"
          class="rpe-opt"
          class:on={value === opt.value}
          on:click={() => pick(opt.value)}
        >
          <span class="rpe-opt-val">{opt.value}</span>
          <span class="rpe-opt-rir">{opt.rir}</span>
        </button>
      {/each}
    </div>

    <button type="button" class="rpe-clear" on:click={clear} disabled={!rated}>
      Clear rating
    </button>
  </div>
{/if}

<style>
  /* ── Chip ── */
  .rpe-chip {
    width: 100%;
    height: 22px;
    border-radius: 7px;
    border: 1px solid rgba(var(--c-fg), 0.12);
    background: rgba(var(--c-fg), 0.04);
    color: rgba(var(--c-fg), 0.45);
    font-size: 11px;
    font-weight: 800;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, border-color 0.12s, color 0.12s;
  }
  .rpe-chip.big { height: 26px; font-size: 12px; border-radius: 8px; }
  .rpe-chip:active { transform: scale(0.96); }

  .rpe-chip.rated {
    background: rgba(var(--c-accent), 0.16);
    border-color: rgba(var(--c-accent), 0.42);
    color: var(--c-accent-solid);
  }
  .rpe-chip.suggest { border-style: dashed; }

  .rpe-num { font-variant-numeric: tabular-nums; }
  .rpe-num.faint { color: rgba(var(--c-fg), 0.38); font-weight: 700; }
  .rpe-lbl { letter-spacing: 0.08em; }

  /* ── Picker sheet ── */
  .rpe-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(var(--c-shadow), 0.6);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .rpe-sheet {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 1001;
    max-height: 86vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 10px 16px calc(16px + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, var(--c-bg-1) 0%, var(--h-080c18) 100%);
    border-top: 1px solid rgba(var(--c-edge-d), 0.22);
    border-radius: 22px 22px 0 0;
    animation: rpe-up 0.22s cubic-bezier(0.32, 0.72, 0, 1) both;
  }

  @keyframes rpe-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }

  .rpe-sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .rpe-title {
    font-size: 15px;
    font-weight: 800;
    color: rgba(var(--c-fg), 0.92);
  }

  .rpe-help {
    width: 26px; height: 26px;
    border-radius: 50%;
    border: 1px solid rgba(var(--c-fg), 0.18);
    background: rgba(var(--c-fg), 0.05);
    color: rgba(var(--c-fg), 0.6);
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    flex-shrink: 0;
  }

  .rpe-edu {
    background: rgba(var(--c-fg), 0.04);
    border: 1px solid rgba(var(--c-fg), 0.10);
    border-radius: 12px;
    padding: 12px 14px;
    margin-bottom: 12px;
    font-size: 13px;
    line-height: 1.45;
    color: rgba(var(--c-fg), 0.7);
  }
  .rpe-edu strong { display: block; margin-bottom: 6px; color: rgba(var(--c-fg), 0.92); font-size: 14px; }
  .rpe-edu p { margin: 4px 0; }
  .rpe-edu b { color: var(--c-accent-solid); }

  .rpe-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .rpe-opt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 12px 6px;
    border-radius: 13px;
    border: 1px solid rgba(var(--c-edge-d), 0.22);
    background: rgba(var(--c-surface-c), 0.6);
    color: rgba(var(--c-fg), 0.85);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, border-color 0.12s, transform 0.05s;
  }
  .rpe-opt:active { transform: scale(0.96); }
  .rpe-opt.on {
    background: rgba(var(--c-accent), 0.18);
    border-color: rgba(var(--c-accent), 0.5);
  }

  .rpe-opt-val {
    font-size: 22px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .rpe-opt.on .rpe-opt-val { color: var(--c-accent-solid); }
  .rpe-opt-rir {
    font-size: 10px;
    font-weight: 600;
    color: rgba(var(--c-fg), 0.42);
    text-align: center;
  }

  .rpe-clear {
    width: 100%;
    margin-top: 12px;
    height: 44px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-fg), 0.14);
    background: rgba(var(--c-fg), 0.04);
    color: rgba(var(--c-fg), 0.6);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .rpe-clear:disabled { opacity: 0.4; cursor: default; }

  @media (min-width: 640px) {
    .rpe-sheet {
      left: 50%; right: auto; bottom: auto; top: 50%;
      transform: translateX(-50%) translateY(-50%);
      width: 420px;
      border-radius: 22px;
      animation: none;
    }
  }
</style>
