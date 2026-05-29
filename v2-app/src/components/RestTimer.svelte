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

  $: pct     = totalSeconds > 0 ? (remaining / totalSeconds) : 0;
  $: mins    = Math.floor(remaining / 60);
  $: secs    = remaining % 60;
  $: display = mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${remaining}`;
  $: warning = remaining <= 5 && remaining > 0;
  $: done    = remaining === 0;
</script>

{#if totalSeconds > 0}
  <div class="rest-pill" class:done class:warning>
    <!-- Progress bar -->
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
    border-radius: 18px;
    border: 1.5px solid rgba(70,110,185,0.35);
    background: rgba(13,24,52,0.92);
    overflow: hidden;
    animation: pill-in 0.18s ease;
    flex-shrink: 0;
  }

  .rest-pill.done {
    border-color: rgba(255,255,255,0.28);
    background: rgba(255,255,255,0.07);
  }

  .rest-pill.warning {
    border-color: rgba(196,148,46,0.50);
    background: rgba(13,24,52,0.95);
  }

  @keyframes pill-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* Progress bar */
  .pill-bar { height: 4px; background: rgba(255,255,255,0.06); }

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
    gap: 16px;
    padding: 18px 20px;
  }

  .pill-info {
    flex: 1 1 0;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .pill-label {
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.40);
    flex-shrink: 0;
  }

  .pill-label.done-lbl {
    font-size: 36px;
    font-weight: 900;
    letter-spacing: -0.02em;
    color: rgba(255,255,255,0.92);
    text-transform: none;
    animation: pop 0.35s cubic-bezier(0.34,1.56,0.64,1);
  }

  @keyframes pop {
    0%   { transform: scale(0.7); opacity: 0.4; }
    65%  { transform: scale(1.15); }
    100% { transform: scale(1);   opacity: 1; }
  }

  /* Big timer number */
  .pill-time {
    font-size: 56px;
    font-weight: 900;
    color: rgba(255,255,255,0.95);
    letter-spacing: -0.04em;
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
    gap: 8px;
    flex-shrink: 0;
  }

  .pill-btn {
    height: 40px;
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
    padding: 0 12px;
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
