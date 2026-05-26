<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let restString: string = ''; // e.g. "90", "90s", "2min", "2:30"

  const dispatch = createEventDispatcher<{ done: void; skip: void }>();

  // Parse rest string to seconds
  function parseRest(s: string): number {
    if (!s) return 0;
    s = s.trim().toLowerCase();
    // "2:30" → 150s
    if (/^\d+:\d+$/.test(s)) {
      const [m, sec] = s.split(':').map(Number);
      return m * 60 + sec;
    }
    // "2min" or "2m"
    const minMatch = s.match(/^(\d+(?:\.\d+)?)\s*min?/);
    if (minMatch) return Math.round(parseFloat(minMatch[1]) * 60);
    // "90s" or "90"
    const secMatch = s.match(/^(\d+(?:\.\d+)?)/);
    if (secMatch) return Math.round(parseFloat(secMatch[1]));
    return 0;
  }

  const totalSeconds = parseRest(restString);
  let remaining = totalSeconds;
  let interval: ReturnType<typeof setInterval> | null = null;
  let running = true;

  if (totalSeconds > 0) {
    interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        remaining = 0;
        clearInterval(interval!);
        interval = null;
        running = false;
        dispatch('done');
      }
    }, 1000);
  }

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  function skip() {
    if (interval) clearInterval(interval);
    interval = null;
    running = false;
    dispatch('skip');
  }

  $: pct = totalSeconds > 0 ? (remaining / totalSeconds) : 0;
  $: mins = Math.floor(remaining / 60);
  $: secs = remaining % 60;
  $: display = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`;

  // Arc path for progress ring
  function arc(pct: number, r = 44): string {
    const angle = pct * 2 * Math.PI;
    const x = 50 + r * Math.sin(angle);
    const y = 50 - r * Math.cos(angle);
    const large = angle > Math.PI ? 1 : 0;
    return pct >= 1
      ? `M 50 6 A 44 44 0 1 1 49.999 6`
      : `M 50 6 A 44 44 0 ${large} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
</script>

{#if totalSeconds > 0}
  <div class="rest-timer">
    <svg class="ring" viewBox="0 0 100 100">
      <circle class="track" cx="50" cy="50" r="44" />
      <path class="fill-arc" d={arc(pct)} />
    </svg>

    <div class="inner">
      <span class="label">REST</span>
      <span class="time">{display}</span>
    </div>

    <button class="skip-btn" on:click={skip}>Skip</button>
  </div>
{/if}

<style>
  .rest-timer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 20px 0 10px;
  }

  .ring {
    width: 120px;
    height: 120px;
    position: relative;
  }

  .track {
    fill: none;
    stroke: rgba(255,255,255,0.06);
    stroke-width: 6;
  }

  .fill-arc {
    fill: none;
    stroke: #4fc08d;
    stroke-width: 6;
    stroke-linecap: round;
    transition: d 0.3s linear;
  }

  .inner {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    pointer-events: none;
    /* positioned inside ring via parent relative */
  }

  /* SVG + inner overlay trick */
  .rest-timer {
    position: relative;
  }

  .ring {
    display: block;
  }

  .inner {
    position: absolute;
    top: 20px; /* padding-top offset */
    left: 50%;
    transform: translateX(-50%);
    width: 120px;
    height: 120px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: #3a8a6a;
    text-transform: uppercase;
  }

  .time {
    font-size: 28px;
    font-weight: 900;
    color: #4fc08d;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }

  .skip-btn {
    padding: 10px 28px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.04);
    color: #4a6a8a;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.03em;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .skip-btn:active {
    background: rgba(255,255,255,0.09);
    color: #7fa8d4;
  }
</style>
