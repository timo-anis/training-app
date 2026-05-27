(function attachRenderGroupComposerBoundary(global) {
  "use strict";

  function renderExerciseGroup(input) {
    const groupHeaderMarkup = String(input?.groupHeaderMarkup || "");
    const groupInnerMarkup = String(input?.groupInnerMarkup || "");
    return `<div class="block-group">${groupHeaderMarkup}<div class="workout-group-stack">${groupInnerMarkup}</div></div>`;
  }

  global.TimoTrainingV2RenderGroupComposer = {
    renderExerciseGroup
  };
})(window);
