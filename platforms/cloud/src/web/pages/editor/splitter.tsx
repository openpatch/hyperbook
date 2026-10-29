import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Read a remembered pane width; `null` while the pane's CSS default applies. */
function storedWidth(key: string) {
  try {
    const stored = Number(localStorage.getItem(key));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

/**
 * A pane's width in px, remembered in the browser. `null` until the user
 * drags a splitter; the pane's CSS default width applies then. Widths are
 * clamped so a pane always fits next to the editor's minimum.
 */
export function usePaneWidth(key: string, min: number) {
  const [width, setWidth] = useState<number | null>(() => storedWidth(key));

  const clamp = useCallback(
    (value: number) => Math.min(value, Math.max(min, window.innerWidth - 640)),
    [min],
  );

  const set = useCallback(
    (value: number | null) => {
      const next = value === null ? null : clamp(value);
      setWidth(next);
      try {
        if (next === null) localStorage.removeItem(key);
        else localStorage.setItem(key, String(next));
      } catch {
        // Remembered for this page only.
      }
    },
    [key, clamp],
  );

  // A remembered width has to keep fitting when the window changes size.
  useEffect(() => {
    if (width === null) return;
    const onResize = () => set(clamp(width));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [width, clamp, set]);

  return [width, set] as const;
}

/**
 * The draggable border between the editor's panes. Dragging (or the arrow
 * keys) reports the pane's new width; double-clicking restores the default.
 *
 * @param pane The pane this splitter resizes; read for the drag's start width.
 * @param direction 1 if dragging right grows the pane, -1 if it shrinks it.
 */
export function Splitter({
  label,
  pane,
  direction,
  onResize,
  onReset,
  className,
}: {
  /** Announced to screen readers; says what the splitter resizes. */
  label: string;
  pane: React.RefObject<HTMLElement | null>;
  direction: 1 | -1;
  onResize: (width: number) => void;
  onReset: () => void;
  className?: string;
}) {
  const start = useRef({ pointer: 0, width: 0 });

  const dragBy = (delta: number) =>
    onResize(start.current.width + direction * delta);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const splitter = event.currentTarget;
    splitter.setPointerCapture(event.pointerId);
    start.current = {
      pointer: event.clientX,
      width: pane.current?.getBoundingClientRect().width ?? 0,
    };
    const style = document.body.style;
    style.userSelect = "none";

    const onPointerMove = (moveEvent: PointerEvent) =>
      dragBy(moveEvent.clientX - start.current.pointer);
    const onPointerUp = () => {
      style.userSelect = "";
      splitter.removeEventListener("pointermove", onPointerMove);
      splitter.removeEventListener("pointerup", onPointerUp);
      splitter.removeEventListener("pointercancel", onPointerUp);
    };
    splitter.addEventListener("pointermove", onPointerMove);
    splitter.addEventListener("pointerup", onPointerUp);
    splitter.addEventListener("pointercancel", onPointerUp);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    start.current = {
      pointer: 0,
      width: pane.current?.getBoundingClientRect().width ?? 0,
    };
    dragBy(event.key === "ArrowRight" ? 16 : -16);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      tabIndex={0}
      title={label}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onReset}
      className={cn(
        "group relative z-10 w-1 shrink-0 cursor-col-resize touch-none outline-none transition-colors",
        "bg-border hover:bg-primary/40 focus-visible:bg-primary/40",
        className,
      )}
    />
  );
}
