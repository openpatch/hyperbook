import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

/** Books keep the reader's choice under the same key. */
const STORAGE_KEY = "dark-mode-toggle";
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const listeners = new Set<() => void>();

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/** Kept here too, for when storage is blocked. */
let chosen = stored();

function current(): Theme {
  return chosen ?? (systemDark.matches ? "dark" : "light");
}

/** The class the inline script in the page head set first (see vite.config.ts). */
function apply() {
  document.documentElement.classList.toggle("dark", current() === "dark");
  for (const listener of listeners) listener();
}

systemDark.addEventListener("change", apply);
// Another tab, or the visual editor's frame and its parent, changed it.
window.addEventListener("storage", (e) => {
  if (e.key !== STORAGE_KEY) return;
  chosen = stored();
  apply();
});

export function setTheme(theme: Theme) {
  chosen = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Remembered for this page only.
  }
  apply();
}

export function useTheme(): Theme {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, current);
}
