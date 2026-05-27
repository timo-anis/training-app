(function attachRenderCalendarBoundary(global) {
  "use strict";

  function buildDayCellMarkup(input) {
    if (input?.inactive) return `<div class="daycell inactive"></div>`;
    const dayTypeClass = String(input?.dayTypeClass || "");
    const activeClass = input?.active ? "active" : "";
    const todayClass = input?.isToday ? "today" : "";
    const dateKey = String(input?.dateKey || "");
    const dayNumber = String(input?.dayNumber || "");
    const weekdayLabel = String(input?.weekdayLabel || "");
    const dot = String(input?.dot || "transparent");
    return `<div class="daycell ${dayTypeClass} ${activeClass} ${todayClass}" data-date="${dateKey}">
      <div class="d">${dayNumber}</div>
      <div class="w">${weekdayLabel}</div>
      <div class="daydot" style="background:${dot}"></div>
    </div>`;
  }

  global.TimoTrainingV2RenderCalendar = {
    buildDayCellMarkup
  };
})(window);
