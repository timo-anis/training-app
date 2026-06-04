import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { initErrorTracking } from './services/errorTracker'

initErrorTracking();

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
