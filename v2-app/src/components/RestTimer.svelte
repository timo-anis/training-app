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
        setTimeout(() => dispatch('done'), 800);
      }
    }
  }

  if (remaining > 0) {
    interval = setInterval(tick, 500);
  } else {
    if (!didPlayDone) {
      didPlayDone = true;
      playDoneSound();
      setTimeout(() => dispatch('done'), 400);
    }
  }

  onDestroy(() => {
    if (interval) clearInterval(interval);
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
  $: mins    = Math.floor(remaining / 60);
  $: secs    = remaining % 60;
  $: display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${remaining}`;
  $: warning = remaining <= 5 && remaining > 0;
  $: done    = remaining === 0;
</script>

{#if totalSeconds > 0}
  <div class="rest-card" class:done class:warning>
    <div class="rest-layout">
      <!-- SVG ring -->
      <div class="ring-wrap">
        <svg class="ring-svg" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
          <circle cx="60" cy="60" r={RING_R} class="ring-track" />
          <circle
            cx="60" cy="60" r={RING_R}
            class="ring-fill"
            class:warning
            class:done
            stroke-dasharray="{RING_C}"
            stroke-dashoffset="{RING_C * (1 - pct)}"
          />
        </svg>
        <div class="ring-center">
          {#if done}
            <span class="ring-go">GO!</span>
          {:else}
            <span class="ring-time" class:warning>{display}</span>
            <span class="ring-label">REST</span>
          {/if}
        </div>
      </div>

      <!-- Actions -->
      <div class="rest-actions">
        <button
          class="pill-btn pill-sound"
          class:sound-on={soundEnabled}
          on:click={toggleSound}
          aria-label={soundEnabled ? 'Mute timer sound' : 'Enable timer sound'}
        >{soundEnabled ? '🔔' : '🔇'}</button>
        <button class="pill-btn" on:click={reset} aria-label="Reset timer">↺</button>
        <button class="pill-btn pill-skip" on:click={skip} aria-label="Skip rest">Skip</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .rest-card {
    border-radius: 18px;
    border: 1.5px solid rgba(70,110,185,0.35);
    background: rgba(13,24,52,0.92);
    padding: 16px 18px;
    animation: pill-in 0.18s ease;
    flex-shrink: 0;
  }

  .rest-card.done  { border-color: rgba(255,255,255,0.28); background: rgba(255,255,255,0.07); }
  .rest-card.warning { border-color: rgba(196,148,46,0.50); }

  @keyframes pill-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .rest-layout {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  /* SVG ring */
  .ring-wrap {
    position: relative;
    flex-shrink: 0;
    width: 120px;
    height: 120px;
  }

  .ring-svg {
    transform: rotate(-90deg);
    display: block;
  }

  .ring-track {
    fill: none;
    stroke: rgba(255,255,255,0.07);
    stroke-width: 8;
  }

  .ring-fill {
    fill: none;
    stroke: rgba(255,255,255,0.70);
    stroke-width: 8;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.5s linear, stroke 0.3s;
  }

  .ring-fill.warning { stroke: #c49230; }
  .ring-fill.done    { stroke: rgba(255,255,255,0.85); }

  .ring-center {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .ring-time {
    font-size: 30px;
    font-weight: 900;
    color: rgba(255,255,255,0.95);
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: color 0.3s;
  }

  .ring-time.warning { color: #c49230; }

  .ring-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
  }

  .ring-go {
    font-size: 26px;
    font-weight: 900;
    color: rgba(255,255,255,0.92);
    letter-spacing: -0.02em;
    animation: pop 0.35s cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes pop {
    0%   { transform: scale(0.7); opacity: 0.4; }
    65%  { transform: scale(1.15); }
    100% { transform: scale(1);   opacity: 1; }
  }

  /* Actions */
  .rest-actions {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pill-btn {
    width: 100%;
    height: 42px;
    padding: 0 14px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(255,255,255,0.06);
    color: rgba(255,255,255,0.60);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.12s, color 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pill-btn:active { background: rgba(255,255,255,0.14); color: rgba(255,255,255,0.92); }

  .pill-sound {
    font-size: 17px;
    opacity: 0.55;
  }

  .pill-sound.sound-on {
    opacity: 1;
    border-color: rgba(196,148,46,0.40);
    background: rgba(196,148,46,0.10);
  }

  .pill-sound:active { background: rgba(255,255,255,0.10); }

  .pill-btn.pill-skip {
    background: rgba(196,148,46,0.10);
    border-color: rgba(196,148,46,0.30);
    color: #c49230;
  }

  .pill-btn.pill-skip:active { background: rgba(196,148,46,0.22); }
</style>
