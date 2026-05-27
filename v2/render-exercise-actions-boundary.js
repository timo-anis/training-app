(function attachExerciseActionsBoundary(global) {
  "use strict";

  function buildExerciseActionsMarkup(input) {
    const exerciseId = String(input?.exerciseId || "");
    const primaryButtonClass = String(input?.primaryButtonClass || "btn");
    const primaryButtonRole = String(input?.primaryButtonRole || "");
    const primaryButtonLabel = String(input?.primaryButtonLabel || "");
    const deleteButtonClass = String(input?.deleteButtonClass || "btn");
    return `<div class="exercise-actions">
	            <button class="${primaryButtonClass}" data-role="${primaryButtonRole}" data-ex="${exerciseId}">${primaryButtonLabel}</button>
	            <button class="${deleteButtonClass}" data-role="delete" data-ex="${exerciseId}">Delete exercise</button>
	          </div>`;
  }

  function buildExerciseActionsInput(input) {
    return {
      exerciseId: String(input?.exerciseId || ""),
      primaryButtonClass: String(input?.primaryButtonClass || "btn"),
      primaryButtonRole: String(input?.primaryButtonRole || ""),
      primaryButtonLabel: String(input?.primaryButtonLabel || ""),
      deleteButtonClass: String(input?.deleteButtonClass || "btn")
    };
  }

  global.TimoTrainingV2RenderExerciseActions = {
    buildExerciseActionsMarkup,
    buildExerciseActionsInput
  };
})(window);
