import { useState, useEffect } from "react";

export type ColorScheme = "light" | "dark";

export function usePrefersColorScheme(): ColorScheme {
  const [preferredColorScheme, setPreferredColorScheme] =
    useState<ColorScheme>("light");

  useEffect(() => {
    if (!window.matchMedia) {
      setPreferredColorScheme("light");
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    setPreferredColorScheme(mediaQuery.matches ? "dark" : "light");

    function onChange(event: MediaQueryListEvent): void {
      setPreferredColorScheme(event.matches ? "dark" : "light");
    }

    mediaQuery.addEventListener("change", onChange);

    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  return preferredColorScheme;
}
