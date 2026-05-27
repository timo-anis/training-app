(function attachRenderGroupingHelpers(global) {
  "use strict";

  function readCode(entry) {
    if (entry && typeof entry === "object" && "code" in entry) {
      return String(entry.code || "").toUpperCase().trim();
    }
    return String(entry || "").toUpperCase().trim();
  }

  function getBlockKey(entry) {
    return (readCode(entry).match(/^([A-Z])/) || [null, "•"])[1];
  }

  function isSupersetStart(exercises, index) {
    const list = Array.isArray(exercises) ? exercises : [];
    const current = list[index];
    if (!current) return false;
    const currentCode = readCode(current);
    if (!/\d$/.test(currentCode)) return false;
    if (index <= 0) return true;
    return getBlockKey(list[index - 1]) !== getBlockKey(current);
  }

  function getGroupIndices(exercises, index) {
    const list = Array.isArray(exercises) ? exercises : [];
    const start = list[index];
    if (!start) return [];
    const block = getBlockKey(start);
    const out = [];
    for (let i = index; i < list.length; i++) {
      if (getBlockKey(list[i]) !== block) break;
      out.push(i);
    }
    return out;
  }

  function getGroupLength(exercises, index) {
    return getGroupIndices(exercises, index).length;
  }

  global.TimoTrainingV2Group = {
    isSupersetStart,
    getGroupLength,
    getGroupIndices
  };
})(window);
