<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';

  /** Epoch ms when this rest period started (from uiState) */
  export let startTime: number;
  /** Total rest duration in seconds */
  export let totalSeconds: number;

  const dispatch = createEventDispatcher<{ done: void; skip: void }>();

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
  <div class="overlay" class:done>
    <div class="timer-wrap">
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 200 200">
          <circle class="track" cx="100" cy="100" r="80" />
          <path class="fill-arc" class:warning class:done d={arc(pct)} />
        </svg>
        <div class="center-text">
          {#if done}
            <span class="done-label">GO!</span>
          {:else}
            <span class="rest-label">REST</span>
            <span class="time" class:warning>{display}</span>
          {/if}
        </div>
      </div>
      <button class="skip-btn" on:click={skip}>Skip rest</button>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(8, 23, 45, 0.95);
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    animation: fade-in 0.15s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .timer-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 36px;
  }

  .ring-wrap {
    position: relative;
    width: 230px;
    height: 230px;
  }

  .ring {
    width: 230px;
    height: 230px;
    display: block;
  }

  .track {
    fill: none;
    stroke: rgba(255,255,255,0.06);
    stroke-width: 10;
  }

  .fill-arc {
    fill: none;
    stroke: #4fc08d;
    stroke-width: 10;
    stroke-linecap: round;
    transition: stroke 0.3s;
  }

  .fill-arc.warning { stroke: #ffc247; }
  .fill-arc.done    { stroke: #4fc08d; }

  .center-text {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    pointer-events: none;
  }

  .rest-label {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: #3a8a6a;
    text-transform: uppercase;
  }

  .time {
    font-size: 72px;
    font-weight: 900;
    color: #4fc08d;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: color 0.3s;
  }

  .time.warning { color: #ffc247; }

  .done-label {
    font-size: 64px;
    font-weight: 900;
    color: #4fc08d;
    letter-spacing: -0.04em;
    animation: pop 0.35s ease;
  }

  @keyframes pop {
    0%   { transform: scale(0.7); opacity: 0.4; }
    65%  { transform: scale(1.15); }
    100% { transform: scale(1);   opacity: 1; }
  }

  .skip-btn {
    padding: 15px 48px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.10);
    background: rgba(255,255,255,0.05);
    color: #4a6a8a;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, color 0.12s;
  }

  .skip-btn:active {
    background: rgba(255,255,255,0.10);
    color: #7fa8d4;
  }
</style>
