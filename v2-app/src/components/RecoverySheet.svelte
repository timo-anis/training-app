<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { appState } from '../stores/app';
  import { computeRecovery, ringColor, trackColor } from '../lib/recovery';

  const dispatch = createEventDispatcher();

  const CIRC = 2 * Math.PI * 28; // r=28 → ≈ 175.9

  $: recovery = computeRecovery($appState.weeks);
  $: readyMuscles = recovery.filter(r => r.ready && r.lastDate !== null).map(r => r.label);
  $: untrainedMuscles = recovery.filter(r => r.lastDate === null).map(r => r.label);
  $: allReady = [...readyMuscles, ...untrainedMuscles];

  function dashOffset(pct: number): number {
    return CIRC * (1 - pct);
  }

  function centerText(r: typeof recovery[0]): string {
    if (r.lastDate === null) return '—';
    if (r.ready) return '✓';
    return `${r.hoursLeft}h`;
  }

  function rpeLabel(rpe: number | null): string {
    if (rpe === null) return 'no RPE';
    return `RPE ${rpe.toFixed(1)}`;
  }

  function agoLabel(h: number | null): string {
    if (h === null) return 'not trained';
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="rec-backdrop" on:click={() => dispatch('close')}>
  <div class="rec-sheet" on:click|stopPropagation>

    <div class="handle"></div>

    <div class="sheet-header">
      <div class="sheet-title-wrap">
        <span class="sheet-title">Recovery status</span>
        <span class="sheet-sub">RPE 9–10 → 72h · RPE 7–8 → 48h · RPE 6 → 36h</span>
      </div>
      <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">✕</button>
    </div>

    <div class="rings-grid">
      {#each recovery as r}
        {@const color = ringColor(r.pct)}
        {@const track = trackColor(r.pct)}
        <div class="ring-item">
          <div class="ring-wrap">
            <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
              <!-- Track -->
              <circle
                cx="36" cy="36" r="28"
                fill="none"
                stroke={track}
                stroke-width="6"
              />
              <!-- Progress (rotated so start is top) -->
              <circle
                cx="36" cy="36" r="28"
                fill="none"
                stroke={color}
                stroke-width="6"
                stroke-linecap="round"
                stroke-dasharray={CIRC}
                stroke-dashoffset={dashOffset(r.pct)}
                transform="rotate(-90 36 36)"
              />
            </svg>
            <div class="ring-center">
              <span class="ring-val" style:color={color}>{centerText(r)}</span>
              {#if r.lastDate !== null && !r.ready}
                <span class="ring-sub">left</span>
              {/if}
            </div>
          </div>
          <span class="ring-label">{r.label.toUpperCase()}</span>
          <span class="ring-meta">{agoLabel(r.hoursAgo)}{r.lastRpe !== null ? ` · ${rpeLabel(r.lastRpe)}` : ''}</span>
        </div>
      {/each}
    </div>

    {#if allReady.length > 0}
      <div class="insight">
        <span class="insight-dot"></span>
        <span class="insight-text">
          Ready to train: <strong>{allReady.join(' · ')}</strong>
        </span>
      </div>
    {:else}
      <div class="insight insight-rest">
        <span class="insight-dot" style="background:#f59e0b"></span>
        <span class="insight-text">All muscle groups still recovering — consider rest or light cardio.</span>
      </div>
    {/if}

  </div>
</div>

<style>
  .rec-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 80;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fade-in 0.15s ease;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .rec-sheet {
    background: linear-gradient(160deg, var(--h-0d1a30, #0d1a30), var(--h-080e1c, #080e1c));
    border: 1px solid rgba(60, 90, 165, 0.25);
    border-radius: 20px 20px 0 0;
    padding: 0 20px 40px;
    width: 100%;
    max-width: 640px;
    max-height: 82dvh;
    overflow-y: auto;
    animation: slide-up 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes slide-up {
    from { transform: translateY(48px); opacity: 0.6; }
    to   { transform: translateY(0);    opacity: 1; }
  }

  .handle {
    width: 40px;
    height: 4px;
    background: rgba(232, 240, 255, 0.14);
    border-radius: 2px;
    margin: 14px auto 18px;
  }

  .sheet-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .sheet-title-wrap { display: flex; flex-direction: column; gap: 3px; }

  .sheet-title {
    font-size: 18px;
    font-weight: 900;
    color: var(--c-accent-solid, #d4a038);
    letter-spacing: -0.03em;
  }

  .sheet-sub {
    font-size: 11px;
    color: rgba(232, 240, 255, 0.38);
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(232, 240, 255, 0.10);
    background: transparent;
    color: rgba(232, 240, 255, 0.35);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    -webkit-tap-highlight-color: transparent;
  }
  .close-btn:active { background: rgba(232,240,255,0.08); }

  /* ── Rings grid ── */
  .rings-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px 4px;
    margin-bottom: 16px;
  }

  .ring-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
  }

  .ring-wrap {
    position: relative;
    width: 72px;
    height: 72px;
  }

  .ring-wrap svg { display: block; }

  .ring-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
  }

  .ring-val {
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .ring-sub {
    font-size: 9px;
    font-weight: 600;
    color: rgba(232,240,255,0.35);
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .ring-label {
    font-size: 10px;
    font-weight: 800;
    color: rgba(232, 240, 255, 0.60);
    letter-spacing: 0.06em;
  }

  .ring-meta {
    font-size: 10px;
    color: rgba(232, 240, 255, 0.30);
    text-align: center;
    line-height: 1.3;
  }

  /* ── Insight chip ── */
  .insight {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 13px;
    background: rgba(79, 192, 141, 0.08);
    border: 1px solid rgba(79, 192, 141, 0.22);
    border-radius: 13px;
    margin-top: 4px;
  }

  .insight-rest {
    background: rgba(245, 158, 11, 0.08);
    border-color: rgba(245, 158, 11, 0.22);
  }

  .insight-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4fc08d;
    flex-shrink: 0;
    margin-top: 3px;
  }

  .insight-text {
    font-size: 13px;
    color: rgba(232, 240, 255, 0.65);
    line-height: 1.45;
  }

  .insight-text strong {
    color: #4fc08d;
    font-weight: 700;
  }
</style>
