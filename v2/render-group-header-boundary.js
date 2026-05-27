(function attachRenderGroupHeaderBoundary(global) {
  "use strict";

  function renderExerciseGroupHeader(input) {
    const blockLabel = String(input?.blockLabel || "");
    const blockMeta = String(input?.blockMeta || "");
    return `<div class="block-header"><div class="block-title"><div class="block-chip">${blockLabel}</div><div>${blockMeta}</div></div></div>`;
  }

  global.TimoTrainingV2RenderGroupHeader = {
    renderExerciseGroupHeader
  };
})(window);
