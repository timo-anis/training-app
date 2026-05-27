(function attachInputValueHelpers(global) {
  "use strict";

  function num(val) {
    if (val === null || val === undefined || val === "") return null;
    const normalized = String(val).replace(",", ".").trim();
    if (!normalized) return null;
    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function sanitizeSetInputValue(role, value) {
    const raw = String(value ?? "");
    if (role === "kg") {
      const normalized = raw.replace(/,/g, ".").replace(/[^0-9.]/g, "");
      const parts = normalized.split(".");
      if (parts.length <= 1) return normalized;
      return `${parts.shift()}.${parts.join("")}`;
    }
    if (role === "reps") {
      return raw.replace(/[^0-9]/g, "");
    }
    return raw;
  }

  function setVolume(set) {
    const kg = num(set?.kg);
    const reps = num(set?.reps);
    if (!Number.isNaN(kg) && !Number.isNaN(reps)) return Math.round(kg * reps);
    if (!Number.isNaN(reps)) return Math.round(reps);
    return "";
  }

  global.TimoTrainingV2Input = {
    num,
    sanitizeSetInputValue,
    setVolume
  };
})(window);
