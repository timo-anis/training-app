(function attachExerciseCompareBoundary(global) {
  "use strict";

  function buildExerciseCompareMarkup(input) {
    const dateLabel = String(input?.dateLabel || "");
    const summaryText = String(input?.summaryText || "");
    const metaText = String(input?.metaText || "");
    if(!dateLabel && !summaryText && !metaText) return "";
    return `<div class="compare compact-last"><div class="last-time-card"><div class="last-time-head"><div class="last-time-title"><span class="dot"></span><span class="k">Last time</span></div><div class="last-time-date">${dateLabel}</div></div><div class="last-time-summary">${summaryText}</div><div class="last-time-meta">${metaText}</div></div></div>`;
  }

  function buildExerciseCompareInput(input) {
    const dateLabel = String(input?.dateLabel || "");
    const summaryText = String(input?.summaryText || "");
    const metaText = String(input?.metaText || "");
    return { dateLabel, summaryText, metaText };
  }

  global.TimoTrainingV2RenderExerciseCompare = {
    buildExerciseCompareMarkup,
    buildExerciseCompareInput
  };
})(window);
