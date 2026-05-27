(function attachSyncStatusHelpers(global) {
  "use strict";

  function getSyncStatusLabel(text) {
    const value = String(text || "");
    if (/Cloud: loaded/i.test(value)) return "Cloud loaded";
    if (/Cloud: synced/i.test(value)) return "Cloud synced";
    if (/Cloud: syncing/i.test(value)) return "Saving to cloud";
    if (/Cloud: loading/i.test(value)) return "Preparing your training";
    if (/Cloud: connecting/i.test(value)) return "Connecting your cloud";
    if (/Cloud: empty/i.test(value)) return "No cloud training yet";
    if (/Cloud: local scoped/i.test(value)) return "Using local training";
    if (/Cloud: local imported/i.test(value)) return "Using imported training";
    if (/Cloud: save blocked/i.test(value)) return "Saved locally only";
    if (/Cloud: unavailable/i.test(value)) return "Cloud unavailable";
    if (/Cloud: save failed/i.test(value)) return "Saved locally only";
    if (/Cloud: offline/i.test(value)) return "Offline";
    if (/local restore/i.test(value)) return "Restored locally";
    if (/local only/i.test(value)) return "Using local mode";
    if (/signing out/i.test(value)) return "Signing out";
    if (/sign out failed/i.test(value)) return "Sign out failed";
    if (/sign in/i.test(value)) return "Sign in";
    return value;
  }

  function getSyncStatusTone(text) {
    const value = String(text || "");
    if (/Cloud: loaded/i.test(value)) return "ok";
    if (/Cloud: synced/i.test(value)) return "ok";
    if (/Cloud: syncing/i.test(value)) return "info";
    if (/Cloud: loading/i.test(value)) return "info";
    if (/Cloud: connecting/i.test(value)) return "info";
    if (/Cloud: empty/i.test(value)) return "info";
    if (/Cloud: local scoped/i.test(value)) return "info";
    if (/Cloud: local imported/i.test(value)) return "info";
    if (/Cloud: save blocked/i.test(value)) return "warn";
    if (/Cloud: unavailable/i.test(value)) return "warn";
    if (/Cloud: save failed/i.test(value)) return "warn";
    if (/Cloud: offline/i.test(value)) return "warn";
    if (/local restore/i.test(value)) return "info";
    if (/local only/i.test(value)) return "info";
    if (/signing out/i.test(value)) return "info";
    if (/sign out failed/i.test(value)) return "warn";
    return "";
  }

  global.TimoTrainingV2SyncStatus = {
    getSyncStatusLabel,
    getSyncStatusTone
  };
})(window);
