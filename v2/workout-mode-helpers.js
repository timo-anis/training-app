(function attachWorkoutModeHelpers(global) {
  "use strict";

  function renderWorkoutHeader(input) {
    const dateDisplay = String(input?.dateDisplay || "");
    const title = String(input?.title || "");
    const progressItems = Array.isArray(input?.progressItems) ? input.progressItems : [];
    const prevLabel = String(input?.prevLabel || "← Previous");
    const nextLabel = String(input?.nextLabel || "Next →");
    const progressMarkup = renderWorkoutProgressPills({ items: progressItems });

    const navMarkup = `<div class="workout-nav-row"><button class="btn" id="prevExerciseBtn">${prevLabel}</button><button class="btn" id="nextExerciseBtn">${nextLabel}</button></div>`;

    return `<div class="card workout-focus-card"><div class="workout-date-big">${dateDisplay}</div><div class="section-title"><h3>${title}</h3></div>${progressMarkup}${navMarkup}</div>`;
  }

  function buildWorkoutHeaderInput(input) {
    return {
      dateDisplay: String(input?.dateDisplay || ""),
      title: String(input?.title || ""),
      progressItems: Array.isArray(input?.progressItems) ? input.progressItems : [],
      prevLabel: String(input?.prevLabel || "← Previous"),
      nextLabel: String(input?.nextLabel || "Next →")
    };
  }

  function renderWorkoutProgressPills(input) {
    const items = Array.isArray(input?.items) ? input.items : [];
    return `<div class="workout-progress-row">${items.map(item => {
      const index = Number(item?.index) || 0;
      const label = String(item?.label || "");
      const className = String(item?.className || "").trim();
      return `<button class="workout-progress-pill ${className}" type="button" data-workout-jump="${index}">${label}</button>`;
    }).join("")}</div>`;
  }

  function renderWorkoutActionPanel() {
    return `<div class="end-panel-shell"><div class="workout-end-panel"><div class="finish-workout-inline-row"><button id="finishWorkoutBtnInline" class="finish-workout-inline-btn" type="button">Finish workout</button></div><div class="workout-end-actions" id="bottomBarInline"><button class="btn workout-footer-secondary" id="bottomTimerBtn">⏱ Timer</button><button class="btn workout-footer-secondary" id="bottomAddExerciseBtn">+ Exercise</button><button class="btn primary workout-footer-primary" id="bottomAddSetBtn">+ Set</button></div></div></div>`;
  }

  function renderWorkoutModeBody(input) {
    const hasContent = !!input?.hasContent;
    const contentMarkup = String(input?.contentMarkup || "");
    const emptyMarkup = String(input?.emptyMarkup || "");
    const actionPanelMarkup = String(input?.actionPanelMarkup || "");
    return hasContent ? `${contentMarkup}${actionPanelMarkup}` : emptyMarkup;
  }

  global.TimoTrainingV2WorkoutMode = {
    buildWorkoutHeaderInput,
    renderWorkoutHeader,
    renderWorkoutProgressPills,
    renderWorkoutActionPanel,
    renderWorkoutModeBody
  };
})(window);
