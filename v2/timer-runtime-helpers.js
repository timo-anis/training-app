(function attachTimerRuntimeHelpers(global) {
  "use strict";

  function getTimerElapsedMs(input) {
    const state = input?.timerState && typeof input.timerState === "object" ? input.timerState : {};
    const now = typeof input?.now === "function" ? input.now() : Date.now();
    const elapsedMs = Math.max(0, Number(state.elapsedMs) || 0);
    const startedAt = Number(state.startedAt) || 0;
    const running = !!state.running;

    if(running && startedAt) {
      return Math.max(0, elapsedMs + (now - startedAt));
    }

    return elapsedMs;
  }

  function formatTimer(input) {
    const totalSeconds = Number(input?.totalSeconds);
    const total = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
    const secs = Math.floor(total % 60).toString().padStart(2, "0");
    return hours > 0 ? `${hours}.${mins}.${secs}` : `${mins}:${secs}`;
  }

  function shouldHoldWorkoutWakeLock(input) {
    return !!(input?.workoutMode || input?.timerRunning);
  }

  function bindTimerOverlayControls(input) {
    const onClose = typeof input?.onClose === "function" ? input.onClose : null;
    const onStart = typeof input?.onStart === "function" ? input.onStart : null;
    const onPause = typeof input?.onPause === "function" ? input.onPause : null;
    const onReset = typeof input?.onReset === "function" ? input.onReset : null;

    const timerCloseBtn = global.document.getElementById("timerCloseBtn");
    const timerStartBtn = global.document.getElementById("timerStartBtn");
    const timerPauseBtn = global.document.getElementById("timerPauseBtn");
    const timerResetBtn = global.document.getElementById("timerResetBtn");
    const timerOverlay = global.document.getElementById("timerOverlay");

    if(timerCloseBtn && onClose) timerCloseBtn.onclick = () => onClose();
    if(timerStartBtn && onStart) timerStartBtn.onclick = () => onStart();
    if(timerPauseBtn && onPause) timerPauseBtn.onclick = () => onPause();
    if(timerResetBtn && onReset) timerResetBtn.onclick = () => onReset();
    if(timerOverlay && onClose) {
      timerOverlay.addEventListener("click", e => {
        if(e.target.id === "timerOverlay") onClose();
      });
    }
  }

  function renderTimerView(input) {
    const elapsedSeconds = Math.max(0, Math.floor(Number(input?.elapsedSeconds) || 0));
    const running = !!input?.running;
    const hasValue = !!input?.hasValue;
    const refs = input?.refs && typeof input.refs === "object" ? input.refs : {};
    const format = typeof input?.formatTimer === "function"
      ? input.formatTimer
      : value => String(value ?? "");

    const display = refs.display || null;
    const bottomTimerBtn = refs.bottomTimerBtn || null;
    const startBtn = refs.startBtn || null;
    const pauseBtn = refs.pauseBtn || null;
    const resetBtn = refs.resetBtn || null;
    const hint = refs.hint || null;
    const sheet = refs.sheet || null;

    if(display) {
      display.textContent = format(elapsedSeconds);
      display.classList.toggle("is-live", running);
      display.classList.toggle("is-paused", !running && hasValue);
    }

    if(sheet) sheet.classList.toggle("is-live", running);

    if(bottomTimerBtn) {
      bottomTimerBtn.classList.toggle("timer-live", running || hasValue);
      bottomTimerBtn.textContent = running
        ? `⏱ ${format(elapsedSeconds)}`
        : (hasValue ? `⏱ ${format(elapsedSeconds)}` : "⏱ Timer");
    }

    if(startBtn) startBtn.textContent = hasValue ? "Resume" : "Start";
    if(startBtn) startBtn.disabled = !!running;

    if(pauseBtn) pauseBtn.disabled = !running;
    if(resetBtn) resetBtn.disabled = !hasValue && !running;

    if(hint) {
      hint.textContent = running
        ? "Timer is running while you keep moving."
        : (hasValue ? "Timer is paused. Resume or reset when you are ready." : "Starts from 00:00 and runs until you stop it.");
    }
  }

  global.TimoTrainingV2TimerRuntime = {
    getTimerElapsedMs,
    formatTimer,
    shouldHoldWorkoutWakeLock,
    bindTimerOverlayControls,
    renderTimerView
  };
})(window);
