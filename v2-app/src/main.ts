import { mount } from 'svelte'
import { get } from 'svelte/store'
import { registerSW } from 'virtual:pwa-register'
import './app.css'
import App from './App.svelte'
import { initErrorTracking } from './services/errorTracker'
import { uiState } from './stores/ui-state'

initErrorTracking();

// PWA: keep the installed (iOS "Add to Home Screen") app up to date.
// registerType is 'autoUpdate', so the generated registerSW reloads the page
// automatically once a new service worker activates. The remaining gap is iOS:
// a standalone home-screen app resumes from a frozen process without a page
// load, so it never re-checks for a new version. We close that gap by forcing
// an update check whenever the app returns to the foreground (and, as a safety
// net, periodically while it stays open).
registerSW({
  immediate: true,
  onRegisteredSW(_swScriptUrl, registration) {
    if (!registration) return;
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') {
        // Never trigger a SW reload mid-workout — it would interrupt the
        // user's session. Defer until they return to the home screen.
        if (get(uiState).workoutActive) return;
        registration.update().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', checkForUpdate);
    setInterval(checkForUpdate, 60 * 60 * 1000);
  },
});

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
