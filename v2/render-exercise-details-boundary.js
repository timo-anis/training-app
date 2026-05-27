(function attachExerciseDetailsBoundary(global) {
  "use strict";

  function buildExerciseDetailsMarkup(input) {
    const prioritizeSets = !!input?.prioritizeSets;
    const restValue = String(input?.restValue || "");
    const noteValue = String(input?.noteValue || "");
    const recoveryMarkup = String(input?.recoveryMarkup || "");
    const setsMarkup = String(input?.setsMarkup || "");
    const secondaryMarkup = `<div class="field-grid field-grid-rest">
            <div class="label">Rest</div>
            <input class="field" data-role="rest" data-ex="${String(input?.exerciseId || "")}" value="${restValue}" placeholder="2:00" />
          </div>
          <div class="field-grid">
            <div class="label">Notes</div>
            <textarea class="textarea" rows="1" data-role="note" data-ex="${String(input?.exerciseId || "")}">${noteValue}</textarea>
          </div>

          ${recoveryMarkup}`;
    return prioritizeSets ? `${setsMarkup}${secondaryMarkup}` : `${secondaryMarkup}${setsMarkup}`;
  }

  function buildExerciseDetailsInput(input) {
    return {
      exerciseId: String(input?.exerciseId || ""),
      prioritizeSets: !!input?.prioritizeSets,
      restValue: String(input?.restValue || ""),
      noteValue: String(input?.noteValue || ""),
      recoveryMarkup: String(input?.recoveryMarkup || ""),
      setsMarkup: String(input?.setsMarkup || "")
    };
  }

  global.TimoTrainingV2RenderExerciseDetails = {
    buildExerciseDetailsMarkup,
    buildExerciseDetailsInput
  };
})(window);
