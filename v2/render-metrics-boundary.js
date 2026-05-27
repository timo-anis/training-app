(function attachRenderMetricsBoundary(global) {
  "use strict";

  function buildMetricsMarkup(input) {
    const week = Number(input?.week) || 0;
    const weekRange = String(input?.weekRange || "");
    const dayLabel = String(input?.dayLabel || "");
    const fullDate = String(input?.fullDate || "");
    const groups = Number(input?.groups) || 0;
    const exerciseCount = Number(input?.exerciseCount) || 0;
    const totalVolume = Number(input?.totalVolume) || 0;
    const doneSets = Number(input?.doneSets) || 0;
    const totalSets = Number(input?.totalSets) || 0;
    const volumeText = totalVolume ? `${totalVolume.toLocaleString("en-GB")} kg` : "0 kg";
    return `
    <div class="metric"><div class="k">Week</div><div class="v">W${week}</div><div class="s">${weekRange}</div></div>
    <div class="metric"><div class="k">Day</div><div class="v">${dayLabel}</div><div class="s">${fullDate}</div></div>
    <div class="metric"><div class="k">Blocks</div><div class="v">${groups || 0}</div><div class="s">${exerciseCount} exercises</div></div>
    <div class="metric"><div class="k">Volume</div><div class="v">${volumeText}</div><div class="s">${doneSets} / ${totalSets} sets done</div></div>
  `;
  }

  global.TimoTrainingV2RenderMetrics = {
    buildMetricsMarkup
  };
})(window);
