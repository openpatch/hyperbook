import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

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

/**
 * The line of text at (x, y) of a page, and the word under the point; null
 * on empty space.
 */
function textAt(boxes: TextBox[], x: number, y: number): { line: string; word: string } | null {
  const hit =
    boxes.find((b) => x >= b.x && x <= b.x + b.width && y >= b.y - b.height && y <= b.y + b.height * 0.25) ??
    // Between two words of a line: the nearest piece on that line.
    boxes
      .filter((b) => y >= b.y - b.height && y <= b.y + b.height * 0.25)
      .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
  if (!hit) return null;
  const line = boxes
    .filter((b) => Math.abs(b.y - hit.y) < hit.height * 0.5)
    .sort((a, b) => a.x - b.x)
    .map((b) => b.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  // The word under the point, by its share of the piece's width.
  const at = Math.min(hit.str.length - 1, Math.max(0, Math.floor(((x - hit.x) / (hit.width || 1)) * hit.str.length)));
  const before = hit.str.slice(0, at + 1).match(/[\p{L}\p{N}]*$/u)?.[0] ?? "";
  const after = hit.str.slice(at + 1).match(/^[\p{L}\p{N}]*/u)?.[0] ?? "";
  return { line, word: before + after };
}

/** Canvases larger than this are scaled down: browsers refuse huge ones. */
const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;

/** Draws every page of `data` into a new list of canvases `width` wide. */
async function drawPages(lib: PdfJs, data: ArrayBuffer, width: number, label: (page: number) => string) {
  // A copy: pdf.js takes the buffer over, and the caller keeps its own.
  const task = lib.getDocument({ data: new Uint8Array(data.slice(0)) });
  const doc = await task.promise;
  try {
    const pages: HTMLCanvasElement[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = width / base.width;
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
    return pages;
  } finally {
    void task.destroy();
  }
}

/**
 * The pages of `data`, as wide as the view. `data` changing draws the new
 * version off screen first and then swaps it in, keeping the scroll position.
 */
export function PdfView({
  data,
  className,
  onTextDoubleClick,
}: {
  data: ArrayBuffer | null;
  className?: string;
  /** A double-click on a line of text: the line and the word under the pointer. */
  onTextDoubleClick?: (text: { line: string; word: string }) => void;
}) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);

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
    void (async () => {
      try {
        const lib = await loadPdfJs();
        const pages = await drawPages(lib, data, width, (page) => t("editor.pdfView.page", { page }));
        if (cancelled || !pagesRef.current) return;
        const el = scroller.current!;
        // The same place in the document, also when its length changed.
        const top = el.scrollTop;
        pagesRef.current.replaceChildren(...pages);
        el.scrollTop = top;
        setFailed(false);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, width, t]);

  return (
    <div ref={scroller} className={cn("min-h-0 overflow-auto bg-muted", className)}>
      {failed && <p className="p-4 text-sm text-destructive">{t("editor.pdfView.failed")}</p>}
      <div
        ref={pagesRef}
        className="flex flex-col items-center gap-4 p-4"
        title={onTextDoubleClick ? t("editor.pdfView.jumpHint") : undefined}
        onDoubleClick={(event) => {
          if (!onTextDoubleClick || !(event.target instanceof HTMLCanvasElement)) return;
          const boxes = pageTexts.get(event.target);
          if (!boxes) return;
          const rect = event.target.getBoundingClientRect();
          const text = textAt(boxes, event.clientX - rect.left, event.clientY - rect.top);
          if (text) {
            event.preventDefault();
            window.getSelection()?.removeAllRanges();
            onTextDoubleClick(text);
          }
        }}
      />
    </div>
  );
}
