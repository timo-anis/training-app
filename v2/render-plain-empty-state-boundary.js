(function attachRenderPlainEmptyStateBoundary(global) {
  "use strict";

  function renderPlainEmptyStateCard(input) {
    const title = String(input?.title || "");
    const metaMarkup = String(input?.metaMarkup || "");
    const body = String(input?.body || "");
    return `<div class="card empty-workout-card"><div class="section-title"><h3>${title}</h3>${metaMarkup}</div><div class="empty-state">${body}</div></div>`;
  }

  function buildPlainEmptyStateInput(input) {
    return {
      title: String(input?.title || ""),
      metaMarkup: String(input?.metaMarkup || ""),
      body: String(input?.body || "")
    };
  }

  global.TimoTrainingV2RenderPlainEmptyState = {
    renderPlainEmptyStateCard,
    buildPlainEmptyStateInput
  };
})(window);
