import { hydrate, mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { applyTheme } from './lib/prefs.svelte.ts';

// Before mounting, so the first paint is already in the chosen theme (the CSP rules out an inline script).
applyTheme();

// The public pages arrive prerendered (src/prerender.ts); the dev server sends an empty #app.
const target = document.getElementById('app')!;
(target.firstChild ? hydrate : mount)(App, { target });

// ADR 9: install and offline support. Production builds only, over a secure context.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => void navigator.serviceWorker.register('/sw.js', { scope: '/' }));
}
