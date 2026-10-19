// Viewer preferences kept in this browser (never a device setting). Storage can
// be blocked or cleared, so every read and write is guarded and the defaults hold.

export type Theme = 'system' | 'light' | 'dark';
const THEMES: readonly Theme[] = ['system', 'light', 'dark'];
const THEME_KEY = 'udb-theme';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Blocked storage: the choice lasts for this page only.
  }
}

const stored = read(THEME_KEY);
export const prefs = $state({ theme: (THEMES as readonly string[]).includes(stored ?? '') ? (stored as Theme) : 'system' });

/** Sets data-theme on <html>; "system" removes it so the OS preference applies (app.css). */
export function applyTheme(theme: Theme = prefs.theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function setTheme(theme: Theme): void {
  prefs.theme = theme;
  write(THEME_KEY, theme);
  applyTheme(theme);
}
