import { MoveHorizontalIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PdfClick } from "./pdf-sync";

/*
 * A PDF drawn with pdf.js inside the editor, instead of the browser's own
 * viewer: that one brings a toolbar and backdrop of its own (dark in Firefox
 * and Chrome alike), which the editor cannot theme, and it starts at page 1
 * on every reload. Here the pages sit on the editor's own surface in light
 * and dark mode, and a new version of the document replaces the old one in
 * place, at the same scroll position, without flashing.
 *
 * pdf.js is the legacy build, loaded on first use, with its worker from the
 * app's own bundle.
 */

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjs: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  pdfjs ??= Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  pdfjs.catch(() => {
    pdfjs = null;
  });
  return pdfjs;
}

/** A piece of a page's text, in CSS pixels of its canvas; `y` is the baseline. */
type TextBox = { str: string; x: number; y: number; width: number; height: number };
/** The text of each drawn page, for double-clicks (see textAt). */
const pageTexts = new WeakMap<HTMLCanvasElement, TextBox[]>();

/** The pieces of a page's text, grouped into lines, top to bottom. */
function linesOf(boxes: TextBox[]): TextBox[][] {
  const lines: TextBox[][] = [];
  for (const box of [...boxes].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0]!.y - box.y) < Math.min(line[0]!.height, box.height) * 0.5) line.push(box);
    else lines.push([box]);
  }
  for (const line of lines) line.sort((a, b) => a.x - b.x);
  return lines;
}

const textOfLine = (line: TextBox[] | undefined) =>
  (line ?? []).map((b) => b.str).join(" ").replace(/\s+/g, " ").trim();
const countWords = (text: string) => text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;

/**
 * The line of text at (x, y) of a page: its text, which of its words is
 * under the point, and the lines around it; null on empty space.
 */
function textAt(boxes: TextBox[], x: number, y: number): Omit<PdfClick, "fraction"> | null {
  const lines = linesOf(boxes);
  const index = lines.findIndex((line) => line.some((b) => y >= b.y - b.height && y <= b.y + b.height * 0.25));
  if (index < 0) return null;
  const line = lines[index]!;
  // The piece under the point, or the nearest one on its line.
  const hit =
    line.find((b) => x >= b.x && x <= b.x + b.width) ??
    [...line].sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0]!;
  // Words of the pieces before it, plus those of the piece before the point.
  const at = Math.min(hit.str.length, Math.max(0, Math.floor(((x - hit.x) / (hit.width || 1)) * hit.str.length)));
  const head = hit.str.slice(0, at).replace(/[\p{L}\p{N}]+$/u, "");
  const wordIndex = line.slice(0, line.indexOf(hit)).reduce((n, b) => n + countWords(b.str), 0) + countWords(head);
  return {
    line: textOfLine(line),
    wordIndex,
    before: textOfLine(lines[index - 1]),
    after: textOfLine(lines[index + 1]),
  };
}

/** Canvases larger than this are scaled down: browsers refuse huge ones. */
const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;

/** CSS pixels per PDF point: at 100%, a page shows at its printed size. */
const CSS_UNITS = 96 / 72;

/** The zoom steps of the + and − buttons; 1 is 100%. */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

/** The next step from `current` (in or out); the ends stay where they are. */
export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction === 1) return ZOOM_STEPS.find((step) => step > current + 0.005) ?? ZOOM_STEPS.at(-1)!;
  return [...ZOOM_STEPS].reverse().find((step) => step < current - 0.005) ?? ZOOM_STEPS[0]!;
}

/**
 * Draws every page of `data` into a new list of canvases: each as wide as
 * `size.width`, or at `size.zoom` (1 is the printed size). Also tells the
 * zoom at which the first page fits `size.width`, for the zoom buttons.
 */
async function drawPages(
  lib: PdfJs,
  data: ArrayBuffer,
  size: { width: number; zoom: number | null },
  label: (page: number) => string,
) {
  // A copy: pdf.js takes the buffer over, and the caller keeps its own.
  const task = lib.getDocument({ data: new Uint8Array(data.slice(0)) });
  const doc = await task.promise;
  let fit = 1;
  try {
    const pages: HTMLCanvasElement[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      if (n === 1) fit = size.width / (base.width * CSS_UNITS);
      const scale = size.zoom === null ? size.width / base.width : size.zoom * CSS_UNITS;
      const viewport = page.getViewport({ scale });
      let ratio = Math.min(window.devicePixelRatio || 1, 3);
      const pixels = viewport.width * viewport.height * ratio * ratio;
      if (pixels > MAX_CANVAS_PIXELS) ratio *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      canvas.className = "block bg-white shadow-sm";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", label(n));
      await page.render({
        canvas,
        canvasContext: canvas.getContext("2d")!,
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      }).promise;
      const content = await page.getTextContent();
      const boxes: TextBox[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const tx = lib.Util.transform(viewport.transform, item.transform);
        boxes.push({
          str: item.str,
          x: tx[4],
          y: tx[5],
          width: item.width * scale,
          height: Math.hypot(tx[2], tx[3]) || item.height * scale,
        });
      }
      pageTexts.set(canvas, boxes);
      pages.push(canvas);
    }
    return { pages, fit };
  } finally {
    void task.destroy();
  }
}

/**
 * The pages of `data`, as wide as the view, or zoomed with the toolbar's
 * buttons or Ctrl and the mouse wheel. `data` changing draws the new version
 * off screen first and then swaps it in, keeping the scroll position.
 */
export function PdfView({
  data,
  className,
  onTextDoubleClick,
}: {
  data: ArrayBuffer | null;
  className?: string;
  /** A double-click on a line of text (see pdf-sync.ts). */
  onTextDoubleClick?: (click: PdfClick) => void;
}) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  /** null: each page as wide as the view; else 1 is 100%. */
  const [zoom, setZoom] = useState<number | null>(null);
  /** The zoom at which the pages fit the view, where + and − start from. */
  const [fitZoom, setFitZoom] = useState(1);
  const shownZoom = zoom ?? fitZoom;
  const zoomBy = (direction: 1 | -1) => setZoom((current) => nextZoom(current ?? fitZoom, direction));
  const zoomByRef = useRef(zoomBy);
  zoomByRef.current = zoomBy;
  /** The zoom the shown pages were drawn at, to keep the place when it changes. */
  const drawnZoom = useRef<number | null | undefined>(undefined);

  // Ctrl (or ⌘) and the wheel zoom, as in a browser; a pinch on a touchpad
  // sends the same. Not passive, so the page itself does not zoom.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let last = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      // A touchpad sends many small steps; one zoom step per moment.
      if (event.timeStamp - last < 120) return;
      last = event.timeStamp;
      zoomByRef.current(event.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Follows the width of the pane (debounced), so pages fit when it is resized.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const measure = () => setWidth(Math.max(0, Math.floor(el.clientWidth - 32)));
    measure();
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, 120);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!data || width < 50) return;
    let cancelled = false;
    // Clicks on + in a row draw once, at the last zoom; a new version of
    // the document draws at once.
    const timer = setTimeout(() => void (async () => {
      try {
        const lib = await loadPdfJs();
        const { pages, fit } = await drawPages(lib, data, { width, zoom }, (page) =>
          t("editor.pdfView.page", { page }),
        );
        if (cancelled || !pagesRef.current) return;
        const el = scroller.current!;
        const zoomed = drawnZoom.current !== undefined && drawnZoom.current !== zoom;
        // A new version: the same place in the document, also when its
        // length changed. A new zoom: the same part of it in the middle.
        const top = el.scrollTop;
        const middle = (el.scrollTop + el.clientHeight / 2) / (el.scrollHeight || 1);
        const center = (el.scrollLeft + el.clientWidth / 2) / (el.scrollWidth || 1);
        pagesRef.current.replaceChildren(...pages);
        if (zoomed) {
          el.scrollTop = middle * el.scrollHeight - el.clientHeight / 2;
          el.scrollLeft = center * el.scrollWidth - el.clientWidth / 2;
        } else el.scrollTop = top;
        drawnZoom.current = zoom;
        setFitZoom(fit);
        setFailed(false);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setFailed(true);
        }
      }
    })(), drawnZoom.current !== undefined && drawnZoom.current !== zoom ? 100 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [data, width, zoom, t]);

  const percent = Math.round(shownZoom * 100);
  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        role="toolbar"
        aria-label={t("editor.pdfView.zoom")}
        className="flex shrink-0 items-center justify-end gap-0.5 border-b border-border bg-background px-2 py-0.5"
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-7 pointer-coarse:size-9"
          aria-label={t("editor.pdfView.zoomOut")}
          title={t("editor.pdfView.zoomOut")}
          disabled={shownZoom <= ZOOM_STEPS[0]! + 0.005}
          onClick={() => zoomBy(-1)}
        >
          <ZoomOutIcon className="size-4" />
        </Button>
        <output
          className="w-12 text-center text-xs text-muted-foreground tabular-nums"
          aria-live="polite"
          aria-label={t("editor.pdfView.zoomLevel", { percent })}
        >
          {percent}%
        </output>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 pointer-coarse:size-9"
          aria-label={t("editor.pdfView.zoomIn")}
          title={t("editor.pdfView.zoomIn")}
          disabled={shownZoom >= ZOOM_STEPS.at(-1)! - 0.005}
          onClick={() => zoomBy(1)}
        >
          <ZoomInIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-7 pointer-coarse:size-9", zoom === null && "bg-accent text-primary")}
          aria-label={t("editor.pdfView.fitWidth")}
          title={t("editor.pdfView.fitWidth")}
          aria-pressed={zoom === null}
          onClick={() => setZoom(null)}
        >
          <MoveHorizontalIcon className="size-4" />
        </Button>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto bg-muted">
      {failed && <p className="p-4 text-sm text-destructive">{t("editor.pdfView.failed")}</p>}
      <div
        ref={pagesRef}
        // As wide as the widest page, at least the view: a zoomed page can be
        // scrolled to its left edge, a small one stays in the middle.
        className="flex w-max min-w-full flex-col items-center gap-4 p-4"
        title={onTextDoubleClick ? t("editor.pdfView.jumpHint") : undefined}
        onDoubleClick={(event) => {
          if (!onTextDoubleClick || !(event.target instanceof HTMLCanvasElement)) return;
          const boxes = pageTexts.get(event.target);
          if (!boxes) return;
          const rect = event.target.getBoundingClientRect();
          const y = event.clientY - rect.top;
          const text = textAt(boxes, event.clientX - rect.left, y);
          if (!text) return;
          event.preventDefault();
          window.getSelection()?.removeAllRanges();
          // How far down the document: pages before, plus the part of this one.
          const pages = [...event.currentTarget.children];
          const fraction = (pages.indexOf(event.target) + y / rect.height) / pages.length;
          onTextDoubleClick({ ...text, fraction });
        }}
      />
      </div>
    </div>
  );
}
