import { useCallback, useSyncExternalStore } from "react";

/** Whether the CSS media `query` matches, following it as the window changes. */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches);
}

/** Below Tailwind's `md`: the editor's file list becomes a drawer. */
export const NARROW = "(max-width: 767px)";
/** Below Tailwind's `lg`: the editor's side panes cover the editor instead of sitting next to it. */
export const COMPACT = "(max-width: 1023px)";
