(function attachSupersetHelpers(global) {
  "use strict";

  function readCode(source) {
    if (source && typeof source === "object" && "code" in source) {
      return String(source.code || "").toUpperCase().trim();
    }
    return String(source || "").toUpperCase().trim();
  }

  function getBlockKey(source) {
    return (readCode(source).match(/^([A-Z])/) || [null, "•"])[1];
  }

  function isSuperset(source) {
    return /\d$/.test(readCode(source));
  }

  function getSupersetLabel(source, index) {
    return isSuperset(source) ? readCode(source) : "";
  }

  function getSupersetGroup(exercises, index) {
    const list = Array.isArray(exercises) ? exercises : [];
    const start = list[index];
    if (!start) return { block: "•", items: [] };
    const block = getBlockKey(start);
    const items = [];
    for (let i = index; i < list.length; i++) {
      const item = list[i];
      if (getBlockKey(item) !== block) break;
      items.push(item);
    }
    return { block, items };
  }

  global.TimoTrainingV2Superset = {
    isSuperset,
    getSupersetGroup,
    getSupersetLabel
  };
})(window);
