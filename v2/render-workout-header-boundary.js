(function attachRenderWorkoutHeaderBoundary(global) {
  "use strict";

  function buildWorkoutHeaderMarkup(input) {
    const dateDisplay = String(input?.dateDisplay || "");
    const title = String(input?.title || "");
    const summaryMarkup = String(input?.summaryMarkup || "");
    const progressMarkup = String(input?.progressMarkup || "");
    const navMarkup = String(input?.navMarkup || "");
    return `<div class="card workout-focus-card"><div class="workout-date-big">${dateDisplay}</div><div class="section-title"><h3>${title}</h3></div>${summaryMarkup}${progressMarkup}${navMarkup}</div>`;
  }

  global.TimoTrainingV2RenderWorkoutHeader = {
    buildWorkoutHeaderMarkup
  };
})(window);
