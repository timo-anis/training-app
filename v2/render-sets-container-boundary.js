(function attachSetsContainerBoundary(global) {
  "use strict";

  function buildSetsContainerMarkup(input) {
    const setRowsMarkup = String(input?.setRowsMarkup || "");
    return `<div class="sets">${setRowsMarkup}</div>`;
  }

  global.TimoTrainingV2RenderSetsContainer = {
    buildSetsContainerMarkup
  };
})(window);
