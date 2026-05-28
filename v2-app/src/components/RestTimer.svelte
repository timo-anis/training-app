<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let startTime: number;
  export let totalSeconds: number;

  const dispatch = createEventDispatcher<{ done: void; skip: void; reset: void }>();

  // ── Sound toggle — persisted to localStorage ──────────────
  const SOUND_KEY = 'timo_training_v4_sound_enabled';
  let soundEnabled: boolean = (() => {
    try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
  })();

  function toggleSound() {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0'); } catch { /* ignore */ }
  }

  // ── Audio — only if sound is enabled ──────────────────────
  function playBeep(freq = 880, duration = 0.18, volume = 0.45) {
    if (!soundEnabled) return;
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
    // Three-tone ascending beep (only when sound is on)
    playBeep(660, 0.15, 0.40);
    setTimeout(() => playBeep(880, 0.15, 0.40), 180);
    setTimeout(() => playBeep(1100, 0.22, 0.45), 360);
    // Vibration always — works on Android, silently ignored on iOS
    try { navigator.vibrate?.([220, 80, 220]); } catch { /* ignore */ }
  }

  // ── Timer logic ───────────────────────────────────────────
  let remaining = Math.max(0, totalSeconds - Math.floor((Date.now() - startTime) / 1000));
  let didPlayDone = false;
  let lastCountdownAt = -1;   // track which second we last vibrated at
  let interval: ReturnType<typeof setInterval> | null = null;

  function tick() {
    remaining = Math.max(0, totalSeconds - Math.floor((Date.now() - startTime) / 1000));

    // 5-second countdown: one short vibration per second (≤5, >0)
    if (remaining <= 5 && remaining > 0 && remaining !== lastCountdownAt) {
      lastCountdownAt = remaining;
      try { navigator.vibrate?.(60); } catch { /* ignore */ }
    }

    if (remaining <= 0) {
      clearInterval(interval!);
      interval = null;
      if (!didPlayDone) {
        didPlayDone = true;
        playDoneSound();
        setTimeout(() => dispatch('done'), 800);
      }
    }
  }

  if (remaining > 0) {
    interval = setInterval(tick, 500);
  } else {
    // Already elapsed while away — fire immediately
    if (!didPlayDone) {
      didPlayDone = true;
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

  $: pct      = totalSeconds > 0 ? (remaining / totalSeconds) : 0;
  $: mins     = Math.floor(remaining / 60);
  $: secs     = remaining % 60;
  $: display  = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${remaining}`;
  $: warning  = remaining <= 5 && remaining > 0;
  $: done     = remaining === 0;
</script>

{#if totalSeconds > 0}
  <div class="rest-pill" class:done class:warning>
    <!-- Thin progress bar -->
    <div class="pill-bar">
      <div class="pill-fill" style="width: {pct * 100}%" class:warning class:done></div>
    </div>

    <div class="pill-body">
      <div class="pill-info">
        {#if done}
          <span class="pill-label done-lbl">GO!</span>
        {:else}
          <span class="pill-label">REST</span>
          <span class="pill-time" class:warning class:pulse={warning}>{display}</span>
        {/if}
      </div>

      <div class="pill-actions">
        <!-- Sound toggle -->
        <button
          class="pill-btn pill-sound"
          class:sound-on={soundEnabled}
          on:click={toggleSound}
          title={soundEnabled ? 'Sound on — tap to mute' : 'Sound off — tap to enable'}
          aria-label={soundEnabled ? 'Mute timer sound' : 'Enable timer sound'}
        >
          {soundEnabled ? '🔔' : '🔇'}
        </button>
        <button class="pill-btn" on:click={reset} aria-label="Reset timer">↺</button>
        <button class="pill-btn pill-skip" on:click={skip} aria-label="Skip rest">Skip</button>
      </div>
    </div>
  </div>
{/if}

<style>
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

  .rest-pill.warning {
    border-color: rgba(196,148,46,0.40);
  }

  @keyframes pill-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Progress bar */
  .pill-bar { height: 3px; background: rgba(255,255,255,0.06); }

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

  /* Pulse animation for last 5 seconds */
  .pill-time.pulse {
    animation: countdown-pulse 1s ease-in-out infinite;
  }

  @keyframes countdown-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.65; transform: scale(0.96); }
  }

  /* Action buttons */
  .pill-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .pill-btn {
    height: 36px;
    padding: 0 12px;
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

  /* Sound toggle */
  .pill-sound {
    padding: 0 10px;
    font-size: 16px;
    opacity: 0.50;
  }

  .pill-sound.sound-on {
    opacity: 1;
    border-color: rgba(196,148,46,0.35);
    background: rgba(196,148,46,0.08);
  }

  .pill-sound:active { background: rgba(255,255,255,0.10); }

  /* Skip button */
  .pill-btn.pill-skip {
    background: rgba(196,148,46,0.10);
    border-color: rgba(196,148,46,0.28);
    color: #c49230;
  }

  .pill-btn.pill-skip:active { background: rgba(196,148,46,0.22); }
</style>
