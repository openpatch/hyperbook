import { MoveHorizontalIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type PdfClick, findInPdf } from "./pdf-sync";

/*
 * A PDF drawn with pdf.js inside the editor, instead of the browser's own
 * viewer: that one brings a toolbar and backdrop of its own (dark in Firefox
 * and Chrome alike), which the editor cannot theme, and it starts at page 1
 * on every reload. Here the pages sit on the editor's own surface in light
 * and dark mode, and a new version of the document replaces the old one in
 * place, at the same scroll position, without flashing.
 *
 * Zooming is immediate: the pages' bitmaps are stretched to the new size at
 * once, keeping the place under the pointer (or the middle of the view), and
 * only the pages in view are drawn again, sharp, once the zooming stops.
 * Pages scrolled to later are drawn when they come into view. The document
 * stays loaded between zooms; only a new version loads again.
 *
 * pdf.js is the legacy build, loaded on first use, with its worker from the
 * app's own bundle.
 */

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfLoading = ReturnType<PdfJs["getDocument"]>;
type PdfDocument = Awaited<PdfLoading["promise"]>;
type RenderTask = ReturnType<Awaited<ReturnType<PdfDocument["getPage"]>>["render"]>;

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

/** A piece of a page's text; `y` is the baseline. */
type TextBox = { str: string; x: number; y: number; width: number; height: number };

/** A page of the shown document. */
type Page = {
  /** 1-based, as pdf.js counts. */
  number: number;
  canvas: HTMLCanvasElement;
  /** Its size at pdf.js's scale 1, in PDF points. */
  baseWidth: number;
  baseHeight: number;
  /** The scale it is laid out at, and the one its bitmap was drawn at (0: not yet). */
  scale: number;
  drawn: number;
  task: RenderTask | null;
  /** Its text in PDF points; null until read. */
  text: TextBox[] | null;
};

/** The page each canvas shows, for double-clicks (see textAt). */
const pageOf = new WeakMap<HTMLCanvasElement, Page>();

/** A page's text in CSS pixels of its canvas as it is laid out now. */
function boxesOf(page: Page): TextBox[] {
  const k = page.scale;
  return (page.text ?? []).map((b) => ({ str: b.str, x: b.x * k, y: b.y * k, width: b.width * k, height: b.height * k }));
}

/** A loaded document and its pages. */
type Shown = { loading: PdfLoading; doc: PdfDocument; pages: Page[]; text: Promise<void> };

/** Reads the text of every page, one after the other, into `page.text`. */
async function readText(lib: PdfJs, doc: PdfDocument, pages: Page[]) {
  for (const page of pages) {
    const pdfPage = await doc.getPage(page.number);
    const viewport = pdfPage.getViewport({ scale: 1 });
    const content = await pdfPage.getTextContent();
    const boxes: TextBox[] = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const tx = lib.Util.transform(viewport.transform, item.transform);
      boxes.push({
        str: item.str,
        x: tx[4],
        y: tx[5],
        width: item.width,
        height: Math.hypot(tx[2], tx[3]) || item.height,
      });
    }
    page.text = boxes;
  }
}

/**
 * Draws `page` at its current scale: off screen first, then copied over its
 * old bitmap at once, so it never shows blank. Gives up quietly when it is
 * cancelled or its scale changed meanwhile.
 */
async function drawPage(doc: PdfDocument, page: Page) {
  const scale = page.scale;
  const pdfPage = await doc.getPage(page.number);
  const viewport = pdfPage.getViewport({ scale });
  let ratio = Math.min(window.devicePixelRatio || 1, 3);
  const pixels = viewport.width * viewport.height * ratio * ratio;
  if (pixels > MAX_CANVAS_PIXELS) ratio *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
  const off = document.createElement("canvas");
  off.width = Math.floor(viewport.width * ratio);
  off.height = Math.floor(viewport.height * ratio);
  page.task?.cancel();
  const task = pdfPage.render({
    canvas: off,
    canvasContext: off.getContext("2d")!,
    viewport,
    transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
  });
  page.task = task;
  try {
    await task.promise;
  } catch (error) {
    if (error instanceof Error && error.name === "RenderingCancelledException") return;
    throw error;
  } finally {
    if (page.task === task) page.task = null;
  }
  if (page.scale !== scale) return;
  page.canvas.width = off.width;
  page.canvas.height = off.height;
  page.canvas.getContext("2d")!.drawImage(off, 0, 0);
  page.drawn = scale;
}

/** The pages within `margin` pixels of `el`'s view, the nearest to its middle first. */
function pagesNear(pages: Page[], el: HTMLElement, margin: number): Page[] {
  const view = el.getBoundingClientRect();
  const middle = (view.top + view.bottom) / 2;
  const near: { page: Page; distance: number }[] = [];
  for (const page of pages) {
    const r = page.canvas.getBoundingClientRect();
    if (r.bottom < view.top - margin || r.top > view.bottom + margin) continue;
    near.push({ page, distance: Math.abs((r.top + r.bottom) / 2 - middle) });
  }
  return near.sort((a, b) => a.distance - b.distance).map((n) => n.page);
}

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

/** How far `y` is from the rectangle's top-to-bottom span; 0 inside it. */
const distanceTo = (r: DOMRect, y: number) => (y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0);

/** What a PdfView can be asked to do from outside. */
export type PdfHandle = {
  /**
   * Scrolls to the line that shows `offset` of the Typst `source` and marks
   * it for a moment (see pdf-sync.ts); false when no line fits.
   */
  reveal: (source: string, offset: number) => Promise<boolean>;
};

/** The drawn pages: the canvases among the children, not the mark. */
const canvasesOf = (pages: HTMLElement) =>
  [...pages.children].filter((c): c is HTMLCanvasElement => c instanceof HTMLCanvasElement);

/** A point of the view, in client pixels, that stays in place while zooming. */
type Anchor = { x: number; y: number };

/**
 * The pages of `data`, as wide as the view, or zoomed with the toolbar's
 * buttons or Ctrl and the mouse wheel. `data` changing draws the new version
 * off screen first and then swaps it in, keeping the scroll position.
 */
export function PdfView({
  data,
  className,
  onTextDoubleClick,
  handle,
}: {
  data: ArrayBuffer | null;
  className?: string;
  /** A double-click on a line of text (see pdf-sync.ts). */
  onTextDoubleClick?: (click: PdfClick) => void;
  /** Set to the view's PdfHandle while it is shown. */
  handle?: RefObject<PdfHandle | null>;
}) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  /** null: each page as wide as the view; else 1 is 100%. */
  const [zoom, setZoom] = useState<number | null>(null);
  /** The width of the first page at scale 1, for the zoom at which it fits. */
  const [firstWidth, setFirstWidth] = useState<number | null>(null);
  const fitZoom = firstWidth && width > 0 ? width / (firstWidth * CSS_UNITS) : 1;
  const shownZoom = zoom ?? fitZoom;
  /** The next zoom keeps this point in place; the middle of the view when null. */
  const anchor = useRef<Anchor | null>(null);
  const zoomBy = (direction: 1 | -1, at: Anchor | null = null) => {
    anchor.current = at;
    setZoom((current) => nextZoom(current ?? fitZoom, direction));
  };
  const zoomByRef = useRef(zoomBy);
  zoomByRef.current = zoomBy;

  /** The loaded document, its pages and the size they are laid out for. */
  const shown = useRef<Shown | null>(null);
  const size = useRef({ width, zoom });
  size.current = { width, zoom };
  const scaleOf = (page: Pick<Page, "baseWidth">) =>
    size.current.zoom === null ? size.current.width / page.baseWidth : size.current.zoom * CSS_UNITS;

  /** Sizes each page for the current width and zoom; their bitmaps stretch until drawn again. */
  const layout = (pages: Page[]) => {
    for (const page of pages) {
      page.scale = scaleOf(page);
      page.canvas.style.width = `${page.baseWidth * page.scale}px`;
      page.canvas.style.height = `${page.baseHeight * page.scale}px`;
    }
  };

  // Drawing the pages near the view sharp, shortly after zooming or
  // scrolling stops; one run at a time, a newer one takes over.
  const drawTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drawRun = useRef(0);
  const drawNear = async () => {
    const run = ++drawRun.current;
    const current = shown.current;
    const el = scroller.current;
    if (!current || !el) return;
    for (const page of pagesNear(current.pages, el, el.clientHeight)) {
      if (run !== drawRun.current || shown.current !== current) return;
      if (page.drawn === page.scale) continue;
      try {
        await drawPage(current.doc, page);
      } catch (error) {
        console.error(error);
      }
    }
  };
  const drawSoon = (delay = 80) => {
    clearTimeout(drawTimer.current);
    drawTimer.current = setTimeout(() => void drawNear(), delay);
  };
  const drawSoonRef = useRef(drawSoon);
  drawSoonRef.current = drawSoon;

  // From the source to its line in the PDF.
  useEffect(() => {
    if (!handle) return;
    let mark: HTMLDivElement | null = null;
    handle.current = {
      async reveal(source, offset) {
        const current = shown.current;
        if (!current) return false;
        await current.text.catch(() => {});
        const el = scroller.current;
        const container = pagesRef.current;
        if (!el || !container || shown.current !== current) return false;
        const lines = current.pages.map((page) => linesOf(boxesOf(page)));
        const place = findInPdf(source, offset, lines.map((page) => page.map((line) => textOfLine(line))));
        if (!place) return false;
        const canvas = current.pages[place.page]!.canvas;
        const line = lines[place.page]![place.line]!;
        // Letters reach about 0.8 of the font size above the baseline; the
        // mark stays on its page.
        const pad = 3;
        const height = canvas.offsetHeight;
        const top = Math.max(pad, Math.min(...line.map((b) => b.y - b.height * 0.8)));
        const bottom = Math.min(height - pad, Math.max(...line.map((b) => b.y + b.height * 0.25)));
        const left = Math.min(...line.map((b) => b.x));
        const right = Math.max(...line.map((b) => b.x + b.width));

        // The line, marked over the page for a moment.
        mark?.remove();
        mark = document.createElement("div");
        mark.dataset.pdfMark = "";
        mark.className = "pointer-events-none absolute rounded-sm bg-yellow-300/50 mix-blend-multiply ring-2 ring-yellow-400";
        Object.assign(mark.style, {
          top: `${canvas.offsetTop + top - pad}px`,
          left: `${canvas.offsetLeft + left - pad}px`,
          width: `${right - left + 2 * pad}px`,
          height: `${bottom - top + 2 * pad}px`,
        });
        container.append(mark);
        const marked = mark;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        marked
          .animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: reduced ? 2500 : 1800 })
          .finished.then(() => marked.remove(), () => marked.remove());

        // In the middle of the view; sideways only when it is out of view.
        const view = el.getBoundingClientRect();
        const box = marked.getBoundingClientRect();
        const y = el.scrollTop + box.top - view.top + box.height / 2 - el.clientHeight / 2;
        const outside = box.left < view.left || box.right > view.left + el.clientWidth;
        el.scrollTo({
          top: y,
          left: outside ? el.scrollLeft + box.left - view.left - 16 : el.scrollLeft,
          behavior: reduced ? "auto" : "smooth",
        });
        return true;
      },
    };
    return () => {
      handle.current = null;
      mark?.remove();
    };
  }, [handle]);

  // Ctrl (or ⌘) and the wheel zoom around the pointer, as in a browser; a
  // pinch on a touchpad sends the same. Not passive, so the page itself
  // does not zoom. Scrolling draws the pages that come into view.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let last = 0;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      // A touchpad sends many small steps; one zoom step per moment.
      if (event.timeStamp - last < 60) return;
      last = event.timeStamp;
      zoomByRef.current(event.deltaY < 0 ? 1 : -1, { x: event.clientX, y: event.clientY });
    };
    const onScroll = () => drawSoonRef.current();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  // Follows the width of the pane, so pages fit when it is resized.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const measure = () => setWidth(Math.max(0, Math.floor(el.clientWidth - 32)));
    measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  // A new zoom or width: the pages resize at once around the anchor, and
  // those in view are drawn sharp again shortly after.
  useEffect(() => {
    const current = shown.current;
    const el = scroller.current;
    if (!current || !el || width < 50) return;
    const view = el.getBoundingClientRect();
    const at = anchor.current ?? { x: (view.left + view.right) / 2, y: (view.top + view.bottom) / 2 };
    anchor.current = null;
    // The page under the anchor (or the nearest), and where on it.
    const near = current.pages
      .map((page) => ({ page, r: page.canvas.getBoundingClientRect() }))
      .sort((a, b) => distanceTo(a.r, at.y) - distanceTo(b.r, at.y))[0];
    const fx = near ? (at.x - near.r.left) / (near.r.width || 1) : 0;
    const fy = near ? (at.y - near.r.top) / (near.r.height || 1) : 0;
    layout(current.pages);
    if (near) {
      const r = near.page.canvas.getBoundingClientRect();
      el.scrollTop += r.top + fy * r.height - at.y;
      el.scrollLeft += r.left + fx * r.width - at.x;
    }
    drawSoon(120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, zoom]);

  // A new document, or a new version of it: loaded, its pages near the view
  // drawn off screen, then swapped in at the same scroll position.
  const ready = width >= 50;
  useEffect(() => {
    if (!data || !ready) return;
    let cancelled = false;
    let loading: PdfLoading | null = null;
    void (async () => {
      try {
        const lib = await loadPdfJs();
        if (cancelled) return;
        // A copy: pdf.js takes the buffer over, and the caller keeps its own.
        loading = lib.getDocument({ data: new Uint8Array(data.slice(0)) });
        const doc = await loading.promise;
        if (cancelled) return;
        const pages: Page[] = [];
        for (let n = 1; n <= doc.numPages; n++) {
          const base = (await doc.getPage(n)).getViewport({ scale: 1 });
          if (cancelled) return;
          const canvas = document.createElement("canvas");
          canvas.className = "block bg-white shadow-sm";
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", t("editor.pdfView.page", { page: n }));
          const page: Page = {
            number: n,
            canvas,
            baseWidth: base.width,
            baseHeight: base.height,
            scale: 0,
            drawn: 0,
            task: null,
            text: null,
          };
          pageOf.set(canvas, page);
          pages.push(page);
        }
        layout(pages);
        const next: Shown = { loading, doc, pages, text: readText(lib, doc, pages) };
        next.text.catch((error) => console.error(error));

        const el = scroller.current!;
        const old = shown.current;
        // The pages where the old version is in view, drawn first: the new
        // version shows sharp right away.
        const inView = old ? pagesNear(old.pages, el, 0).map((p) => pages[p.number - 1]).filter((p) => !!p) : [];
        for (const page of inView) {
          await drawPage(doc, page);
          if (cancelled) return;
        }
        if (!pagesRef.current) return;
        const top = el.scrollTop;
        const left = el.scrollLeft;
        pagesRef.current.replaceChildren(...pages.map((p) => p.canvas));
        el.scrollTop = top;
        el.scrollLeft = left;
        shown.current = next;
        loading = null;
        if (old) {
          for (const page of old.pages) page.task?.cancel();
          void old.loading.destroy();
        }
        setFirstWidth(pages[0]?.baseWidth ?? null);
        setFailed(false);
        drawSoonRef.current(0);
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (loading) void loading.destroy();
    };
  }, [data, ready, t]); // eslint-disable-line react-hooks/exhaustive-deps

  // The document is let go with the view.
  useEffect(
    () => () => {
      clearTimeout(drawTimer.current);
      const current = shown.current;
      shown.current = null;
      if (current) void current.loading.destroy();
    },
    [],
  );

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
        className="relative flex w-max min-w-full flex-col items-center gap-4 p-4"
        title={onTextDoubleClick ? t("editor.pdfView.jumpHint") : undefined}
        onDoubleClick={(event) => {
          if (!onTextDoubleClick || !(event.target instanceof HTMLCanvasElement)) return;
          const page = pageOf.get(event.target);
          if (!page?.text) return;
          const boxes = boxesOf(page);
          const rect = event.target.getBoundingClientRect();
          const y = event.clientY - rect.top;
          const text = textAt(boxes, event.clientX - rect.left, y);
          if (!text) return;
          event.preventDefault();
          window.getSelection()?.removeAllRanges();
          // How far down the document: pages before, plus the part of this one.
          const pages = canvasesOf(event.currentTarget);
          const fraction = (pages.indexOf(event.target) + y / rect.height) / pages.length;
          onTextDoubleClick({ ...text, fraction });
        }}
      />
      </div>
    </div>
  );
}
