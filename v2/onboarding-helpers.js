(function attachOnboardingHelpers(global) {
  "use strict";

  function shouldShowFirstWorkoutCta(input) {
    const hasCurrentUser = !!input?.currentUser;
    const hasSearchQuery = !!input?.hasSearchQuery;
    const hasWorkoutData = !!input?.hasWorkoutData;
    return hasCurrentUser && !hasSearchQuery && !hasWorkoutData;
  }

  global.TimoTrainingV2Onboarding = {
    shouldShowFirstWorkoutCta
  };
})(window);
