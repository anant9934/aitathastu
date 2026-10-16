"use client";

/**
 * Site-wide Dark/Light theme (D-2). Dark is the default. The choice is stored
 * per device in localStorage and applied before first paint by THEME_SCRIPT
 * (inlined in app/layout.tsx), so there is no flash on load or navigation.
 */
import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";

export type Theme = "dark" | "light";

const listeners = new Set<() => void>();

function read(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  // Suppress transitions for one frame so nothing animates its colours.
  root.classList.add("theme-switching");
  root.dataset.theme = theme;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
  listeners.forEach((l) => l());
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or blocked storage: the theme still applies for this page.
  }
  apply(theme);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the theme.
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) apply(e.newValue === "light" ? "light" : "dark");
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);
  return [theme, setTheme];
}
