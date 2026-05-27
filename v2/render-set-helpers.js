(function attachSetHelpers(global) {
  "use strict";

  function getSetDisplayIndex(set, index) {
    return String(Number(index) + 1);
  }

  function getSetDoneState(set) {
    return String(set?.done || "");
  }

  function getSetRepsValue(set) {
    return set?.reps ?? "";
  }

  function getSetWeightValue(set) {
    return set?.kg ?? "";
  }

  global.TimoTrainingV2Set = {
    getSetDisplayIndex,
    getSetDoneState,
    getSetRepsValue,
    getSetWeightValue
  };
})(window);
