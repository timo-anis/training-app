(function attachWorkoutSummaryHelpers(global) {
  "use strict";

  function formatSetSummaryLine(set) {
    return `${set?.kg || "—"} × ${set?.reps || "—"}`;
  }

  function buildSetSummary(sets) {
    return (Array.isArray(sets) ? sets : []).map(formatSetSummaryLine).join(" • ");
  }

  function countTotalSets(sets) {
    return Array.isArray(sets) ? sets.length : 0;
  }

  function countCompletedSets(sets) {
    return (Array.isArray(sets) ? sets : []).reduce((sum, set) => {
      return sum + (String(set?.done || "") === "1" ? 1 : 0);
    }, 0);
  }

  function parseNumericValue(value) {
    if (value === null || value === undefined || value === "") return null;
    const normalized = String(value).replace(",", ".").trim();
    if (!normalized) return null;
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function setVolume(set) {
    const kg = parseNumericValue(set?.kg);
    const reps = parseNumericValue(set?.reps);
    if (!Number.isNaN(kg) && !Number.isNaN(reps)) return Math.round(kg * reps);
    if (!Number.isNaN(reps)) return Math.round(reps);
    return "";
  }

  function sumExerciseVolume(sets) {
    return (Array.isArray(sets) ? sets : []).reduce((sum, set) => {
      const volume = setVolume(set);
      if (!volume) return sum;
      return sum + (Number(volume) || 0);
    }, 0);
  }

  function formatSetRowDisplay(set, index) {
    return {
      setNumber: String(Number(index) + 1),
      volume: String(setVolume(set) || "")
    };
  }

  global.TimoTrainingV2Summary = {
    formatSetSummaryLine,
    buildSetSummary,
    countTotalSets,
    countCompletedSets,
    sumExerciseVolume,
    formatSetRowDisplay
  };
})(window);
