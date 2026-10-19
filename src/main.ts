import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { applyTheme } from './lib/prefs.svelte.ts';

// Before mounting, so the first paint is already in the chosen theme (the CSP rules out an inline script).
applyTheme();

mount(App, { target: document.getElementById('app')! });

// ADR 9: install and offline support. Production builds only, over a secure context.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => void navigator.serviceWorker.register('./sw.js'));
}
