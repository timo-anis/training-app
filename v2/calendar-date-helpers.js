(function attachCalendarDateHelpers(global) {
  "use strict";

  function formatLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseLocalDateKey(dateKey) {
    const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    return new Date(year, monthIndex, day);
  }

  function normalizePersistedUiSelection(selection, dayOrder) {
    if (!selection || typeof selection !== "object") return null;
    const week = Number(selection.week);
    const day = String(selection.day || "");
    if (!Number.isFinite(week) || week < 1) return null;
    if (!Array.isArray(dayOrder) || !dayOrder.includes(day)) return null;
    return { week: Math.floor(week), day };
  }

  function buildInitialUiSelection(config) {
    const persistedSelection = normalizePersistedUiSelection(config?.persistedSelection, config?.dayOrder);
    const initialWeek = persistedSelection?.week ?? Number(config?.initialWeek);
    const fallbackDay = typeof config?.getFirstDay === "function"
      ? config.getFirstDay(initialWeek)
      : null;
    const initialDay = persistedSelection?.day ?? fallbackDay;
    const initialDate = typeof config?.dayDate === "function"
      ? config.dayDate(initialWeek, initialDay)
      : null;
    const month = initialDate
      ? new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
      : null;
    return { persistedSelection, initialWeek, initialDay, initialDate, month };
  }

  function mapCalendarSelection(dateKey, dateToProgramDay) {
    const clickedDate = parseLocalDateKey(dateKey);
    if (!clickedDate || Number.isNaN(clickedDate.getTime())) return null;
    const info = typeof dateToProgramDay === "function" ? dateToProgramDay(clickedDate) : null;
    if (!info) return null;
    return {
      clickedDate,
      info,
      monthDate: new Date(clickedDate.getFullYear(), clickedDate.getMonth(), 1)
    };
  }

  global.TimoTrainingV2Calendar = {
    formatLocalDateKey,
    parseLocalDateKey,
    normalizePersistedUiSelection,
    buildInitialUiSelection,
    mapCalendarSelection
  };
})(window);
