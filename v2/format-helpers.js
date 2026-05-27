(function attachFormatHelpers(global) {
  "use strict";

  function parseRestSeconds(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return 0;
    if (/^\d+$/.test(raw)) {
      const total = Math.max(0, Number(raw) || 0);
      return raw.length <= 2 && total <= 10 ? total * 60 : total;
    }
    const parts = raw.split(":").map(part => part.trim()).filter(Boolean);
    if (parts.some(part => !/^\d+$/.test(part))) return 0;
    if (parts.length === 2) {
      const [m, s] = parts.map(Number);
      return Math.max(0, m * 60 + s);
    }
    if (parts.length === 3) {
      const [h, m, s] = parts.map(Number);
      return Math.max(0, h * 3600 + m * 60 + s);
    }
    return 0;
  }

  function formatRestSeconds(totalSeconds) {
    const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function normalizeRestValue(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    return formatRestSeconds(parseRestSeconds(raw));
  }

  global.TimoTrainingV2Format = {
    parseRestSeconds,
    formatRestSeconds,
    normalizeRestValue
  };
})(window);
