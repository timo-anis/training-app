(function attachExerciseRenderHelpers(global) {
  "use strict";

  function formatExerciseHeaderDisplay(input) {
    const displayName = String(input?.name || "");
    const metaText = [
      input?.supersetLabel ? `Superset item ${input.supersetLabel}` : (input?.code ? `Block item ${input.code}` : ""),
      input?.recovery ? "Recovery / conditioning" : "",
      input?.weighted ? "Weighted" : ""
    ].filter(Boolean).join(" • ");
    return { displayName, metaText };
  }

  function renderExerciseHeaderMetaMarkup(input) {
    const exerciseId = String(input?.exerciseId || "");
    const codeValue = String(input?.codeValue || "");
    const displayName = String(input?.displayName || "");
    const metaText = String(input?.metaText || "");
    return `<div class="exercise-main">
            <div class="left-main">
              <input class="codebox" data-role="code" data-ex="${exerciseId}" value="${codeValue}" />
              <div style="min-width:0;width:100%">
                <input class="exercise-name field" type="text" data-role="name" data-ex="${exerciseId}" value="${displayName}" />
                <div class="exercise-meta">${metaText}</div>
              </div>
            </div>
          </div>`;
  }

  global.TimoTrainingV2Render = {
    formatExerciseHeaderDisplay,
    renderExerciseHeaderMetaMarkup
  };
})(window);
