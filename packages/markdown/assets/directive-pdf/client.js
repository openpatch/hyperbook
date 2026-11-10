/// <reference path="../hyperbook.types.js" />

/**
 * PDF documents on a page, drawn with pdf.js.
 *
 * The library is loaded when the first document comes near the viewport,
 * pages are drawn when they do, and dropped again when they are far away,
 * so a long script costs a tablet no more than the pages in sight.
 *
 * @memberof hyperbook
 * @see hyperbook.i18n
 */
hyperbook.pdf = (function () {
  "use strict";

  const assetBase = new URL(
    "directive-pdf/",
    new URL(HYPERBOOK_ASSETS, document.baseURI),
  ).href;

  /** Canvases larger than this are scaled down: mobile browsers refuse them. */
  const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;
  const MAX_PIXEL_RATIO = 3;
  /** How far ahead of the viewport pages are drawn. */
  const AHEAD = "800px 0px";

  const t = (key, fallback, values) =>
    hyperbook.i18n.get(key, values, fallback);

  /** Where this element's pdf.js lives: the book's assets, or what the build chose. */
  const runtimeOf = (el) => {
    let given = {};
    try {
      given = JSON.parse(el.getAttribute("data-runtime") || "{}");
    } catch {}
    const base = new URL(given.base || assetBase, document.baseURI).href;
    return {
      base,
      lib: new URL(given.lib || "pdf.min.mjs", base).href,
      worker: new URL(given.worker || "pdf.worker.min.mjs", base).href,
    };
  };

  let library = null;
  const loadLibrary = (runtime) => {
    if (!library) {
      library = import(runtime.lib).then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = runtime.worker;
        return lib;
      });
      // A failed download may work on the next try.
      library.catch(() => {
        library = null;
      });
    }
    return library;
  };

  /** `1-2,5-` as page numbers of a document with `total` pages. */
  const pageNumbers = (ranges, total) => {
    if (!ranges) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    for (const part of ranges.split(",")) {
      const [first, last] = part.split("-");
      const from = Number(first);
      const to = last === undefined ? from : last === "" ? total : Number(last);
      for (let page = from; page <= Math.min(to, total); page++) {
        if (page >= 1 && !pages.includes(page)) pages.push(page);
      }
    }
    return pages;
  };

  const element = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  /**
   * One page's place in the document: sized before it is drawn, so the
   * scroll position holds while pages come and go.
   */
  class PageSlot {
    constructor(doc, number, lib, ratio) {
      this.doc = doc;
      this.number = number;
      this.lib = lib;
      this.el = element("div", "pdf-page");
      this.el.dataset.page = String(number);
      this.el.style.aspectRatio = ratio;
      this.drawnWidth = 0;
      this.drawnHeight = 0;
      this.task = null;
      this.generation = 0;
    }

    /** Draws the page to fit the slot. `fit` also bounds the height (slides). */
    async draw(fit) {
      const generation = ++this.generation;
      const page = await this.doc.getPage(this.number);
      if (generation !== this.generation) return;
      const base = page.getViewport({ scale: 1 });
      if (!fit) this.el.style.aspectRatio = `${base.width} / ${base.height}`;

      const available = fit || {
        width: this.el.clientWidth,
        height: Infinity,
      };
      // Not laid out (a closed tab or collapsible): drawn when it shows.
      if (!available.width) return;
      const scale = Math.min(
        available.width / base.width,
        available.height / base.height,
      );
      const viewport = page.getViewport({ scale });
      const width = Math.floor(viewport.width);
      const height = Math.floor(viewport.height);
      if (width === this.drawnWidth && height === this.drawnHeight) return;

      let ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const pixels = width * height * ratio * ratio;
      if (pixels > MAX_CANVAS_PIXELS) {
        ratio *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
      }

      const canvas = element("canvas");
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.setAttribute("role", "img");
      canvas.setAttribute(
        "aria-label",
        t("pdf-page", "Page {{page}}", { page: this.number }),
      );

      this.task?.cancel();
      const task = page.render({
        canvas,
        canvasContext: canvas.getContext("2d"),
        viewport,
        transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
      });
      this.task = task;
      try {
        await task.promise;
      } catch (error) {
        // Cancelled for a newer draw: that one shows the page.
        if (error?.name === "RenderingCancelledException") return;
        throw error;
      }
      if (generation !== this.generation) return;
      this.task = null;

      // Selectable, searchable and readable text above the picture.
      const text = element("div", "textLayer");
      this.el.style.setProperty("--total-scale-factor", String(scale));
      if (fit) {
        this.el.style.width = `${width}px`;
        this.el.style.height = `${height}px`;
      }
      this.el.replaceChildren(canvas, text);
      this.drawnWidth = width;
      this.drawnHeight = height;
      try {
        await new this.lib.TextLayer({
          textContentSource: page.streamTextContent(),
          container: text,
          viewport,
        }).render();
      } catch {
        // The picture is there; a page without a text layer still reads.
      }
    }

    /** Frees the canvas of a page that is out of sight. */
    clear() {
      this.generation++;
      this.task?.cancel();
      this.task = null;
      for (const canvas of this.el.querySelectorAll("canvas")) {
        // Releases the bitmap at once instead of waiting for the collector.
        canvas.width = 0;
        canvas.height = 0;
      }
      this.el.replaceChildren();
      this.drawnWidth = 0;
      this.drawnHeight = 0;
    }
  }

  const showError = (viewer, fallback, error) => {
    console.error("[hyperbook.pdf]", error);
    const message = element(
      "p",
      "pdf-error",
      t("pdf-error", "The document could not be shown."),
    );
    viewer.replaceChildren(message);
    if (fallback) viewer.append(fallback);
  };

  /** All pages below each other, each as wide as the element. */
  const showPages = (viewer, doc, lib, numbers, ratio) => {
    const slots = numbers.map((n) => new PageSlot(doc, n, lib, ratio));
    const bySlotEl = new Map(slots.map((slot) => [slot.el, slot]));
    const inSight = new Set();
    const draw = (slot) =>
      slot.draw().catch((error) => console.error("[hyperbook.pdf]", error));

    const sight = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const slot = bySlotEl.get(entry.target);
          if (entry.isIntersecting) {
            inSight.add(slot);
            draw(slot);
          } else {
            inSight.delete(slot);
            slot.clear();
          }
        }
      },
      { rootMargin: AHEAD },
    );
    viewer.replaceChildren(...slots.map((slot) => slot.el));
    for (const slot of slots) sight.observe(slot.el);

    let timer;
    new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => inSight.forEach(draw), 150);
    }).observe(viewer);
  };

  /** The first page, small: a picture of the document beside its title. */
  const showThumb = (viewer, doc, lib, numbers, ratio, href) => {
    const slot = new PageSlot(doc, numbers[0], lib, ratio);
    const link = element("a", "pdf-thumb");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", t("pdf-open", "Open document"));
    link.append(slot.el);
    viewer.replaceChildren(link);
    slot.draw().catch((error) => console.error("[hyperbook.pdf]", error));
  };

  /** One page at a time, with previous/next, arrow keys and fullscreen. */
  const showSlides = (root, viewer, doc, lib, numbers, ratio) => {
    const stage = element("div", "pdf-stage");
    stage.style.setProperty("--pdf-ratio", ratio);
    const slot = new PageSlot(doc, numbers[0], lib, ratio);
    stage.append(slot.el);

    const button = (className, label, symbol) => {
      const el = element("button", className, symbol);
      el.type = "button";
      el.title = label;
      el.setAttribute("aria-label", label);
      return el;
    };
    const previous = button("pdf-previous", t("pdf-previous", "Previous page"), "‹");
    const next = button("pdf-next", t("pdf-next", "Next page"), "›");
    const counter = element("span", "pdf-counter");
    counter.setAttribute("aria-live", "polite");
    const fullscreen = button("pdf-fullscreen", t("pdf-fullscreen", "Fullscreen"), "⛶");
    const controls = element("div", "pdf-controls");
    controls.append(previous, counter, next, fullscreen);

    let index = 0;
    const draw = () => {
      slot.drawnWidth = 0;
      return slot
        .draw({ width: stage.clientWidth, height: stage.clientHeight })
        .catch((error) => console.error("[hyperbook.pdf]", error));
    };
    const go = (to) => {
      const target = Math.max(0, Math.min(numbers.length - 1, to));
      if (target === index && slot.drawnWidth) return;
      index = target;
      slot.number = numbers[index];
      slot.el.dataset.page = String(slot.number);
      counter.textContent = `${index + 1} / ${numbers.length}`;
      previous.disabled = index === 0;
      next.disabled = index === numbers.length - 1;
      draw();
    };

    previous.addEventListener("click", () => go(index - 1));
    next.addEventListener("click", () => go(index + 1));

    viewer.tabIndex = 0;
    viewer.addEventListener("keydown", (event) => {
      const keys = {
        ArrowLeft: index - 1,
        ArrowUp: index - 1,
        PageUp: index - 1,
        ArrowRight: index + 1,
        ArrowDown: index + 1,
        PageDown: index + 1,
        " ": index + 1,
        Home: 0,
        End: numbers.length - 1,
      };
      if (!(event.key in keys) || event.target.closest("button")) return;
      event.preventDefault();
      go(keys[event.key]);
    });

    // A swipe turns the page, like a tap on the buttons.
    let startX = null;
    stage.addEventListener(
      "touchstart",
      (event) => {
        startX = event.touches.length === 1 ? event.touches[0].clientX : null;
      },
      { passive: true },
    );
    stage.addEventListener(
      "touchend",
      (event) => {
        if (startX === null) return;
        const moved = event.changedTouches[0].clientX - startX;
        startX = null;
        // Selecting text also moves the finger: only a clear swipe counts.
        if (Math.abs(moved) < 60 || String(getSelection())) return;
        go(index + (moved < 0 ? 1 : -1));
      },
      { passive: true },
    );

    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    const current = () =>
      document.fullscreenElement || document.webkitFullscreenElement;
    if (!request || !exit) {
      fullscreen.hidden = true;
    } else {
      fullscreen.addEventListener("click", () => {
        if (current() === root) exit.call(document);
        else request.call(root);
      });
    }

    viewer.replaceChildren(stage, controls);
    let timer;
    new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(draw, 100);
    }).observe(stage);
    go(0);
  };

  const start = async (root) => {
    const viewer = root.querySelector(".pdf-viewer");
    if (!viewer) return;
    const fallback = viewer.querySelector(".pdf-fallback");
    const view = root.dataset.view;
    const src = root.dataset.src;
    const runtime = runtimeOf(root);

    const loading = element("p", "pdf-loading", t("pdf-loading", "Loading document…"));
    viewer.prepend(loading);
    try {
      const lib = await loadLibrary(runtime);
      const doc = await lib.getDocument({
        url: new URL(src, document.baseURI).href,
        cMapUrl: new URL("cmaps/", runtime.base).href,
        cMapPacked: true,
        standardFontDataUrl: new URL("standard_fonts/", runtime.base).href,
        wasmUrl: new URL("wasm/", runtime.base).href,
        iccUrl: new URL("iccs/", runtime.base).href,
      }).promise;
      const numbers = pageNumbers(root.dataset.pages, doc.numPages);
      if (numbers.length === 0) {
        throw new Error(`No page of ${src} is in "${root.dataset.pages}"`);
      }
      // Every slot starts with the first page's shape, the usual one.
      const first = (await doc.getPage(numbers[0])).getViewport({ scale: 1 });
      const ratio = `${first.width} / ${first.height}`;

      if (view === "slides") showSlides(root, viewer, doc, lib, numbers, ratio);
      else if (view === "thumb") showThumb(viewer, doc, lib, numbers, ratio, src);
      else showPages(viewer, doc, lib, numbers, ratio);
      root.classList.add("pdf-ready");
    } catch (error) {
      showError(viewer, fallback, error);
    }
  };

  /** Starts a document when it comes near the viewport. */
  const near = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        near.unobserve(entry.target);
        start(entry.target);
      }
    },
    { rootMargin: AHEAD },
  );

  const init = (root) => {
    const found = [];
    if (root.matches?.(".directive-pdf[data-view]")) found.push(root);
    found.push(...root.querySelectorAll(".directive-pdf[data-view]"));
    for (const el of found) {
      if (el.dataset.view === "embed" || el.dataset.pdfInit) continue;
      el.dataset.pdfInit = "true";
      near.observe(el);
    }
  };

  document.addEventListener("DOMContentLoaded", () => init(document));

  // Pages added later (the editor's preview, protected content once opened).
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) init(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  return { init };
})();
