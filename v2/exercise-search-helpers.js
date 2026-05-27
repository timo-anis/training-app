(function attachExerciseSearchHelpers(global) {
  "use strict";

  function normalizeQuery(query) {
    return String(query || "").trim().toLowerCase();
  }

  function matchExerciseName(name, query) {
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) return true;
    const nameLower = String(name || "").trim().toLowerCase();
    return nameLower.startsWith(normalizedQuery);
  }

  function filterExercises(list, query) {
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) return Array.isArray(list) ? list.slice() : [];
    return (Array.isArray(list) ? list : []).filter(item => {
      const name = typeof item === "string" ? item : item?.name;
      return matchExerciseName(name, normalizedQuery);
    });
  }

  global.TimoTrainingV2Search = {
    normalizeQuery,
    matchExerciseName,
    filterExercises
  };
})(window);
