(function attachRenderWorkoutContainerBoundary(global) {
  "use strict";

  function buildWorkoutContainerMarkup(input) {
    const headerMarkup = String(input?.headerMarkup || "");
    const contentMarkup = String(input?.contentMarkup || "");
    const emptyMarkup = String(input?.emptyMarkup || "");
    const hasContent = !!input?.hasContent;
    return `${headerMarkup}${hasContent ? contentMarkup : emptyMarkup}`;
  }

  global.TimoTrainingV2RenderWorkoutContainer = {
    buildWorkoutContainerMarkup
  };
})(window);
