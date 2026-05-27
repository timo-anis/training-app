(function attachExerciseShellBoundary(global) {
  "use strict";

  function buildExerciseShellMarkup(input) {
    const exerciseClass = String(input?.exerciseClass || "");
    const exerciseId = String(input?.exerciseId || "");
    const mainMarkup = String(input?.mainMarkup || "");
    const compareMarkup = String(input?.compareMarkup || "");
    const detailsMarkup = String(input?.detailsMarkup || "");
    const actionsMarkup = String(input?.actionsMarkup || "");
    return `<div class="exercise ${exerciseClass}" data-exercise-card="${exerciseId}">${mainMarkup}${compareMarkup}${detailsMarkup}${actionsMarkup}</div>`;
  }

  function buildExerciseShellInput(input) {
    return {
      exerciseClass: String(input?.exerciseClass || ""),
      exerciseId: String(input?.exerciseId || "")
    };
  }

  function renderNormalExerciseCard(input) {
    const exerciseShellInput = input?.exerciseShellInput && typeof input.exerciseShellInput === "object"
      ? input.exerciseShellInput
      : {};
    const nextInput = {
      ...exerciseShellInput,
      mainMarkup: String(input?.mainMarkup || ""),
      compareMarkup: String(input?.compareMarkup || ""),
      detailsMarkup: String(input?.detailsMarkup || ""),
      actionsMarkup: String(input?.actionsMarkup || "")
    };
    return buildExerciseShellMarkup(nextInput);
  }

  function renderSingleExerciseCard(input) {
    return buildExerciseShellMarkup(input);
  }

  function renderSupersetExerciseCard(input) {
    return buildExerciseShellMarkup(input);
  }

  global.TimoTrainingV2RenderExercise = {
    buildExerciseShellMarkup,
    buildExerciseShellInput,
    renderNormalExerciseCard,
    renderSingleExerciseCard,
    renderSupersetExerciseCard
  };
})(window);
