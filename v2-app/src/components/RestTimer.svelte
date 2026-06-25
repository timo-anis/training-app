<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let startTime: number;
  export let totalSeconds: number;

  const dispatch = createEventDispatcher<{ done: void; skip: void; reset: void }>();

  // ── Sound toggle — persisted to localStorage ──────────────
  const SOUND_KEY = 'timo_training_v4_sound_enabled';
  let soundEnabled: boolean = (() => {
    try {
      const v = localStorage.getItem(SOUND_KEY);
      return v === null ? true : v === '1'; // default ON
    } catch { return true; }
  })();

  function toggleSound() {
    soundEnabled = !soundEnabled;
    try { localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0'); } catch { /* ignore */ }
  }

  // ── AudioContext singleton — reuse instead of creating new each time ──
  // Creating new AudioContext() on every beep causes iOS to suspend it.
  let _audioCtx: AudioContext | null = null;

  function getAudioCtx(): AudioContext | null {
    try {
      if (!_audioCtx) _audioCtx = new AudioContext();
      // Resume if suspended (iOS suspends after inactivity)
      if (_audioCtx.state === 'suspended') _audioCtx.resume();
      return _audioCtx;
    } catch { return null; }
  }

  function playBeep(freq = 880, duration = 0.18, volume = 0.45) {
    if (!soundEnabled) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch { /* ignore */ }
  }

  function playDoneSound() {
    // Three-tone ascending beep (only when sound is on)
    playBeep(660, 0.15, 0.40);
    setTimeout(() => playBeep(880, 0.15, 0.40), 180);
    setTimeout(() => playBeep(1100, 0.22, 0.45), 360);
    // Vibration always — works on Android, silently ignored on iOS
    try { navigator.vibrate?.([220, 80, 220]); } catch { /* ignore */ }
  }

  function playCountdownTick(secondsLeft: number) {
    // Ascending intensity: louder and higher pitch as countdown reaches 0
    // secondsLeft: 5→1. At 1 it's the loudest/highest.
    const t = (6 - secondsLeft) / 5; // 0.2 at 5s, 1.0 at 1s
    const freq   = 800 + t * 400;    // 800Hz → 1200Hz
    const volume = 0.35 + t * 0.35;  // 0.35 → 0.70
    playBeep(freq, 0.12, volume);
  }

  // ── Timer logic ───────────────────────────────────────────
  let remaining = Math.max(0, totalSeconds - Math.floor((Date.now() - startTime) / 1000));
  let didPlayDone = false;
  let lastCountdownAt = -1;
  let interval: ReturnType<typeof setInterval> | null = null;
  let doneTimer: ReturnType<typeof setTimeout> | null = null;

  // Schedule the done dispatch. If screen is currently hidden (Android screen-off),
  // we don't auto-dismiss — we wait for visibilitychange and give 6s then.
  function scheduleDone() {
    if (document.hidden) return; // will be scheduled in handleVisibility
    if (doneTimer) return;
    doneTimer = setTimeout(() => dispatch('done'), 800);
  }

  function handleVisibility() {
    if (document.visibilityState !== 'visible') return;
    if (didPlayDone && doneTimer === null) {
      // Screen came back after timer had already expired — re-alert and give 6s
      try { navigator.vibrate?.([200, 80, 200]); } catch { /* ignore */ }
      doneTimer = setTimeout(() => dispatch('done'), 6000);
    }
  }
  document.addEventListener('visibilitychange', handleVisibility);

  function tick() {
    remaining = Math.max(0, totalSeconds - Math.floor((Date.now() - startTime) / 1000));

    // 5-second countdown: vibration + beep (when sound on) once per second
    if (remaining <= 5 && remaining > 0 && remaining !== lastCountdownAt) {
      lastCountdownAt = remaining;
      try { navigator.vibrate?.(60); } catch { /* ignore */ }
      playCountdownTick(remaining);
    }

    if (remaining <= 0) {
      clearInterval(interval!);
      interval = null;
      if (!didPlayDone) {
        didPlayDone = true;
        playDoneSound();
        scheduleDone();
      }
    }
  }

  if (remaining > 0) {
    interval = setInterval(tick, 500);
  } else {
    // Timer already expired on mount (restored from localStorage after screen-off/tab-kill).
    // Show GO! — don't auto-dismiss. User must tap Skip to continue.
    if (!didPlayDone) {
      didPlayDone = true;
      // No sound on restore: would be confusing out of context
    }
  }

  onDestroy(() => {
    if (interval) clearInterval(interval);
    if (doneTimer) clearTimeout(doneTimer);
    document.removeEventListener('visibilitychange', handleVisibility);
  });

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

  const RING_R = 52;
  const RING_C = 2 * Math.PI * RING_R;

  $: pct     = totalSeconds > 0 ? (remaining / totalSeconds) : 0;

  // Large focus mode — starts expanded, user can minimize
  let minimized = false;
  $: mins    = Math.floor(remaining / 60);
  $: secs    = remaining % 60;
  $: display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${remaining}`;
  $: warning = remaining <= 5 && remaining > 0;
  $: done    = remaining === 0;
</script>

{#if totalSeconds > 0}
  {#if !minimized}
    <!-- LARGE FOCUS MODE -->
    <div class="timer-overlay" class:done class:warning>
      <button class="minimize-btn" on:click={() => minimized = true} aria-label="Minimize timer">
        <span class="minimize-icon">⌃</span> Minimize
      </button>

      <div class="large-ring-wrap">
        <svg class="large-ring-svg" viewBox="0 0 240 240" aria-hidden="true">
          <circle cx="120" cy="120" r="108" class="ring-track" />
          <circle
            cx="120" cy="120" r="108"
            class="ring-fill"
            class:warning
            class:done
            stroke-dasharray="{RING_C * 108 / RING_R}"
            stroke-dashoffset="{(RING_C * 108 / RING_R) * (1 - pct)}"
          />
        </svg>
        <div class="large-ring-center">
          {#if done}
            <span class="large-go">GO!</span>
          {:else}
            <span class="large-time" class:warning class:pulse={warning}>{display}</span>
            <span class="large-label">REST</span>
          {/if}
        </div>
      </div>

      <div class="large-actions">
        <button
          class="large-btn sound-btn"
          class:sound-on={soundEnabled}
          on:click={toggleSound}
          aria-label={soundEnabled ? 'Mute' : 'Unmute'}
        >{soundEnabled ? '🔔' : '🔇'}</button>
        <button class="large-btn reset-btn" on:click={reset} aria-label="Reset">↺</button>
        <button class="large-btn skip-btn" on:click={skip} aria-label="Skip">Skip</button>
      </div>
    </div>
  {:else}
    <!-- MINIMIZED COMPACT VIEW — tap anywhere to expand -->
    <button class="rest-card compact" class:done class:warning
      on:click={() => minimized = false}
      aria-label="Expand timer to fullscreen"
    >
      <div class="compact-layout">
        <div class="compact-ring-wrap">
          <svg viewBox="0 0 60 60" width="60" height="60" aria-hidden="true">
            <circle cx="30" cy="30" r="26" class="ring-track" stroke-width="4" />
            <circle
              cx="30" cy="30" r="26"
              class="ring-fill"
              class:warning
              class:done
              stroke-width="4"
              stroke-dasharray="{RING_C * 26 / RING_R}"
              stroke-dashoffset="{(RING_C * 26 / RING_R) * (1 - pct)}"
            />
          </svg>
          <div class="compact-center">
            {#if done}
              <span class="compact-go">GO</span>
            {:else}
              <span class="compact-time" class:warning>{display}</span>
            {/if}
          </div>
        </div>
        <div class="compact-info">
          <span class="compact-label">{done ? 'GO!' : 'REST · tap to expand'}</span>
        </div>
      </div>
    </button>
  {/if}
{/if}

<style>
  /* ===== LARGE FOCUS MODE ===== */
  .timer-overlay {
    position: fixed;
    inset: 0;
    z-index: 150;
    background: radial-gradient(ellipse at 50% 40%, var(--c-bg-1) 0%, var(--h-06080f) 60%, var(--h-030406) 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 32px;
    padding: env(safe-area-inset-top) 24px env(safe-area-inset-bottom);
    animation: fade-in 0.2s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .timer-overlay.warning { background: radial-gradient(ellipse at 50% 40%, var(--h-1a1200) 0%, var(--h-06080f) 60%, var(--h-030406) 100%); }
  .timer-overlay.done    { background: radial-gradient(ellipse at 50% 40%, var(--h-0a1a0a) 0%, var(--h-06080f) 60%, var(--h-030406) 100%); }

  .minimize-btn {
    position: absolute;
    top: calc(16px + env(safe-area-inset-top));
    right: 20px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 14px;
    border-radius: 12px;
    border: 1px solid rgba(var(--c-fg), 0.14);
    background: rgba(var(--c-fg), 0.06);
    color: rgba(var(--c-fg), 0.45);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    letter-spacing: 0.02em;
  }

  .minimize-btn:active { background: rgba(var(--c-fg), 0.12); color: rgba(var(--c-fg), 0.75); }
  .minimize-icon { font-size: 16px; line-height: 1; }

  .large-ring-wrap {
    position: relative;
    width: 240px;
    height: 240px;
    flex-shrink: 0;
  }

  .large-ring-svg {
    transform: rotate(-90deg);
    display: block;
    width: 100%;
    height: 100%;
  }

  .ring-track {
    fill: none;
    stroke: rgba(var(--c-fg), 0.07);
    stroke-width: 10;
  }

  .ring-fill {
    fill: none;
    stroke: rgba(var(--c-fg), 0.70);
    stroke-width: 10;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.5s linear, stroke 0.3s;
  }

  .ring-fill.warning { stroke: var(--c-accent-solid); }
  .ring-fill.done    { stroke: rgba(var(--c-fg), 0.85); }

  .large-ring-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .large-time {
    font-size: 72px;
    font-weight: 900;
    color: rgba(var(--c-fg), 0.95);
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: color 0.3s;
  }

  .large-time.warning { color: var(--c-accent-solid); }

  .large-time.pulse {
    animation: countdown-pulse 1s ease-in-out infinite;
  }

  @keyframes countdown-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.65; transform: scale(0.96); }
  }

  .large-label {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(var(--c-fg), 0.30);
  }

  .large-go {
    font-size: 56px;
    font-weight: 900;
    color: rgba(var(--c-fg), 0.92);
    letter-spacing: -0.02em;
    animation: pop 0.35s cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes pop {
    0%   { transform: scale(0.7); opacity: 0.4; }
    65%  { transform: scale(1.15); }
    100% { transform: scale(1);   opacity: 1; }
  }

  .large-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .large-btn {
    height: 52px;
    padding: 0 22px;
    border-radius: 16px;
    border: 1px solid rgba(var(--c-fg), 0.14);
    background: rgba(var(--c-fg), 0.06);
    color: rgba(var(--c-fg), 0.60);
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, color 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 60px;
  }

  .large-btn:active { background: rgba(var(--c-fg), 0.14); color: rgba(var(--c-fg), 0.92); }

  .large-btn.sound-btn { font-size: 20px; opacity: 0.55; }
  .large-btn.sound-btn.sound-on { opacity: 1; border-color: rgba(var(--c-accent), 0.40); background: rgba(var(--c-accent), 0.10); }

  .large-btn.skip-btn {
    background: rgba(var(--c-accent), 0.10);
    border-color: rgba(var(--c-accent), 0.30);
    color: var(--c-accent-solid);
    font-size: 15px;
    letter-spacing: 0.04em;
    font-weight: 800;
  }

  .large-btn.skip-btn:active { background: rgba(var(--c-accent), 0.22); }

  /* ===== COMPACT MODE ===== */
  .rest-card {
    border-radius: 18px;
    border: 1.5px solid rgba(var(--c-edge-e), 0.35);
    background: rgba(var(--c-surface-b), 0.92);
    padding: 12px 14px;
    animation: pill-in 0.18s ease;
    flex-shrink: 0;
    width: 100%;
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s;
  }

  .rest-card:active { background: var(--c-20-36-70-0_95); }

  .rest-card.done    { border-color: rgba(var(--c-fg), 0.28); background: rgba(var(--c-fg), 0.07); }
  .rest-card.warning { border-color: rgba(var(--c-accent), 0.50); }

  @keyframes pill-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .compact-layout {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .compact-ring-wrap {
    position: relative;
    flex-shrink: 0;
    width: 60px;
    height: 60px;
  }

  .compact-ring-wrap svg {
    transform: rotate(-90deg);
    display: block;
  }

  .compact-center {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .compact-time {
    font-size: 16px;
    font-weight: 900;
    color: rgba(var(--c-fg), 0.90);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .compact-time.warning { color: var(--c-accent-solid); }

  .compact-go {
    font-size: 13px;
    font-weight: 900;
    color: rgba(var(--c-fg), 0.90);
    letter-spacing: 0.04em;
  }

  .compact-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .compact-label {
    font-size: 12px;
    font-weight: 700;
    color: rgba(var(--c-fg), 0.35);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

</style>
