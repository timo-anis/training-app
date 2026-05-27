<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';

  /** Epoch ms when this rest period started (from uiState) */
  export let startTime: number;
  /** Total rest duration in seconds */
  export let totalSeconds: number;

  const dispatch = createEventDispatcher<{ done: void; skip: void; reset: void }>();

  function playBeep(freq = 880, duration = 0.18, volume = 0.5) {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch { /* AudioContext not available */ }
  }

  function playDoneSound() {
    playBeep(660, 0.15, 0.45);
    setTimeout(() => playBeep(880, 0.15, 0.45), 180);
    setTimeout(() => playBeep(1100, 0.25, 0.5), 360);
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
  }

  // Compute remaining from timestamp so re-mounting after background resumes correctly
  let remaining = Math.max(0, totalSeconds - Math.floor((Date.now() - startTime) / 1000));
  let didPlaySound = false;
  let interval: ReturnType<typeof setInterval> | null = null;

  if (remaining > 0) {
    interval = setInterval(() => {
      remaining = Math.max(0, totalSeconds - Math.floor((Date.now() - startTime) / 1000));
      if (remaining <= 0) {
        remaining = 0;
        clearInterval(interval!);
        interval = null;
        if (!didPlaySound) {
          didPlaySound = true;
          playDoneSound();
          setTimeout(() => dispatch('done'), 800);
        }
      }
    }, 500);
  } else {
    // Already elapsed while we were away — fire immediately
    if (!didPlaySound) {
      didPlaySound = true;
      playDoneSound();
      setTimeout(() => dispatch('done'), 400);
    }
  }

  onDestroy(() => { if (interval) clearInterval(interval); });

  function skip() {
    if (interval) clearInterval(interval);
    interval = null;
    dispatch('skip');
  }

  function reset() {
    if (interval) clearInterval(interval);
    interval = null;
    dispatch('reset');
  }

  $: pct = totalSeconds > 0 ? (remaining / totalSeconds) : 0;
  $: mins = Math.floor(remaining / 60);
  $: secs = remaining % 60;
  $: display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${remaining}`;
  $: warning = remaining <= 5 && remaining > 0;
  $: done = remaining === 0;

  function arc(pct: number, r = 80): string {
    const angle = pct * 2 * Math.PI;
    const x = 100 + r * Math.sin(angle);
    const y = 100 - r * Math.cos(angle);
    const large = angle > Math.PI ? 1 : 0;
    return pct >= 1
      ? `M 100 20 A 80 80 0 1 1 99.999 20`
      : `M 100 20 A 80 80 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
</script>

{#if totalSeconds > 0}
  <div class="rest-pill" class:done class:warning>
    <div class="pill-bar">
      <div class="pill-track">
        <div class="pill-fill" style="width: {pct * 100}%" class:warning class:done></div>
      </div>
    </div>
    <div class="pill-body">
      <div class="pill-info">
        {#if done}
          <span class="pill-label done-lbl">GO!</span>
        {:else}
          <span class="pill-label">REST</span>
          <span class="pill-time" class:warning>{display}</span>
        {/if}
      </div>
      <div class="pill-actions">
        <button class="pill-btn" on:click={reset} aria-label="Reset timer">↺</button>
        <button class="pill-btn pill-skip" on:click={skip} aria-label="Skip rest">Skip</button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Compact rest pill — inline in the workout content */
  .rest-pill {
    border-radius: 16px;
    border: 1px solid rgba(70,110,185,0.28);
    background: rgba(13,24,52,0.85);
    overflow: hidden;
    animation: pill-in 0.18s ease;
    flex-shrink: 0;
  }

  .rest-pill.done {
    border-color: rgba(255,255,255,0.28);
    background: rgba(255,255,255,0.07);
  }

  @keyframes pill-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Thin progress bar at top */
  .pill-bar {
    height: 3px;
    background: rgba(255,255,255,0.06);
  }

  .pill-fill {
    height: 100%;
    background: rgba(255,255,255,0.70);
    border-radius: 0 2px 2px 0;
    transition: width 0.5s linear, background 0.3s;
  }

  .pill-fill.warning { background: #c49230; }
  .pill-fill.done    { background: rgba(255,255,255,0.80); width: 100% !important; }

  /* Body row */
  .pill-body {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
  }

  .pill-info {
    flex: 1 1 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .pill-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.40);
    flex-shrink: 0;
  }

  .pill-label.done-lbl {
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: rgba(255,255,255,0.90);
    text-transform: none;
    animation: pop 0.35s cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes pop {
    0%   { transform: scale(0.7); opacity: 0.4; }
    65%  { transform: scale(1.15); }
    100% { transform: scale(1);   opacity: 1; }
  }

  .pill-time {
    font-size: 32px;
    font-weight: 900;
    color: rgba(255,255,255,0.92);
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: color 0.3s;
  }

  .pill-time.warning { color: #c49230; }

  /* Action buttons */
  .pill-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .pill-btn {
    height: 36px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.55);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, color 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pill-btn:active { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.90); }

  .pill-btn.pill-skip {
    background: rgba(196,148,46,0.10);
    border-color: rgba(196,148,46,0.28);
    color: #c49230;
  }

  .pill-btn.pill-skip:active { background: rgba(196,148,46,0.22); }
</style>
