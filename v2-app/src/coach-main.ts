import { mount } from 'svelte'
import './app.css'
import CoachApp from './CoachApp.svelte'
import { initErrorTracking } from './services/errorTracker'

// Coach surface boot. Deliberately minimal: NO service worker, NO PWA register,
// NO trainee boot/sync machinery. The trainee index.html PWA is untouched.
initErrorTracking();

const app = mount(CoachApp, {
  target: document.getElementById('coach-app')!,
})

export default app
