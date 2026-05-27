(function attachFeedbackHelpers(global) {
  "use strict";

  function getFirstWorkoutCreatedMessage(input) {
    const isFirstWorkout = !!input?.isFirstWorkout;
    if (isFirstWorkout) return "Workout started";
    return "";
  }

  global.TimoTrainingV2Feedback = {
    getFirstWorkoutCreatedMessage
  };
})(window);
