(function attachEmptyStateRenderHelpers(global) {
  "use strict";

  function renderFirstWorkoutEmptyState(input) {
    const title = String(input?.title || "");
    const metaMarkup = String(input?.metaMarkup || "");
    return `<div class="card empty-workout-card"><div class="section-title"><h3>${title}</h3>${metaMarkup}</div><div class="empty-state"><div class="empty-workout-hero"><div class="empty-workout-eyebrow">Start here</div><div class="empty-workout-body">Create your first workout day with one exercise, then build from your own training rhythm.</div><div class="empty-workout-support">Nothing is prefilled. Your calendar will take shape from the workouts you actually log.</div></div><button class="btn primary empty-workout-cta" id="emptyStateAddWorkoutBtn" type="button">Add first workout</button></div></div>`;
  }

  function buildFirstWorkoutEmptyStateInput(input) {
    return {
      title: String(input?.title || ""),
      metaMarkup: String(input?.metaMarkup || "")
    };
  }

  global.TimoTrainingV2EmptyState = {
    renderFirstWorkoutEmptyState,
    buildFirstWorkoutEmptyStateInput
  };
})(window);
