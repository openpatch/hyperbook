import { buildPage } from "./page.js";

/**
 * Graphic comparison for the Web IDE.
 *
 * Browsers cannot photograph a frame, so a page is drawn the way an SVG image
 * can show HTML: after the page ran in a hidden frame, a copy of its DOM goes
 * into a <foreignObject>, with stylesheets, images and canvases inlined (an
 * SVG image may not load anything itself). This misses a few things a browser
 * shows -- CSS background images, web fonts from elsewhere -- but it misses
 * them the same way for the solution and the reader's page, so the
 * comparison stays fair.
 */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = (win) => new Promise((resolve) => win.requestAnimationFrame(() => resolve()));

const toDataUrl = async (url) => {
  if (!url || url.startsWith("data:")) return url;
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
};

/** The CSS of a stylesheet the page loaded, or "" if it is not readable. */
const cssOf = (sheet) => {
  try {
    return [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
  } catch {
    return "";
  }
};

/**
 * A copy of the page's DOM that an SVG image can show on its own.
 * @param {Document} doc The rendered page.
 */
const inlineCopy = async (doc) => {
  const copy = doc.documentElement.cloneNode(true);

  // Stylesheets: the link's rules, in its place.
  const liveLinks = [...doc.querySelectorAll('link[rel~="stylesheet"]')];
  const copiedLinks = [...copy.querySelectorAll('link[rel~="stylesheet"]')];
  copiedLinks.forEach((link, i) => {
    const style = doc.createElement("style");
    style.textContent = liveLinks[i]?.sheet ? cssOf(liveLinks[i].sheet) : "";
    link.replaceWith(style);
  });

  // Canvases show what was drawn on them.
  const liveCanvases = [...doc.querySelectorAll("canvas")];
  [...copy.querySelectorAll("canvas")].forEach((canvas, i) => {
    const live = liveCanvases[i];
    const img = doc.createElement("img");
    try {
      img.src = live.toDataURL();
    } catch {
      // A canvas tainted by another origin stays empty.
    }
    img.setAttribute("style", live.getAttribute("style") || "");
    img.width = live.clientWidth || live.width;
    img.height = live.clientHeight || live.height;
    canvas.replaceWith(img);
  });

  // Images as data, which an SVG image may show.
  await Promise.all(
    [...copy.querySelectorAll("img[src]")].map(async (img) => {
      try {
        img.setAttribute("src", await toDataUrl(img.getAttribute("src")));
      } catch {
        img.removeAttribute("src");
      }
    }),
  );

  // Scripts already ran; the copy shows their result.
  copy.querySelectorAll("script, noscript").forEach((node) => node.remove());
  return copy;
};

/**
 * Renders a workspace's page at the given size and returns a canvas of it.
 *
 * @param {HTMLElement} host Where the hidden frame may live while it renders.
 * @param {{path: string, content?: string, url?: string, role?: string}[]} files
 * @param {string} main
 * @param {number} width
 * @param {number} height
 */
export const captureWebPage = async (host, files, main, width, height) => {
  const { html, urls } = buildPage(files, main, (blob) => URL.createObjectURL(blob));
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  const loaded = new Promise((resolve) =>
    iframe.addEventListener("load", resolve, { once: true }),
  );
  iframe.srcdoc = html;
  host.appendChild(iframe);
  try {
    await loaded;
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    // Let scripts run and the page settle: fonts, a first animation frame.
    await doc.fonts?.ready;
    await nextFrame(win);
    await sleep(150);
    await nextFrame(win);

    const copy = await inlineCopy(doc);
    copy.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    // A browser paints the page's background (the root's, or else the
    // body's) across the whole window; inside an SVG nobody does.
    const canvasBackground = (() => {
      const transparent = (style) =>
        style.backgroundColor === "rgba(0, 0, 0, 0)" &&
        style.backgroundImage === "none";
      const root = win.getComputedStyle(doc.documentElement);
      if (!transparent(root) || !doc.body) return root;
      return win.getComputedStyle(doc.body);
    })();
    copy.style.backgroundColor = canvasBackground.backgroundColor;
    copy.style.backgroundImage = canvasBackground.backgroundImage;
    // The copy has the frame's size, and no scrollbars to differ by.
    copy.style.width = `${width}px`;
    copy.style.height = `${height}px`;
    copy.style.overflow = "hidden";
    const body = new XMLSerializer().serializeToString(copy);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<foreignObject x="0" y="0" width="100%" height="100%">${body}</foreignObject></svg>`;

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("The page could not be drawn."));
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    iframe.remove();
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
};

/**
 * Graphic comparison for a Web IDE with `compare`: the target over the page
 * and a panel below it. The page is scored as the reader types: the caller
 * calls changed().
 */
export const setupComparison = (elem, ide) => {
  const { createComparison, loadImage, normalize } = HyperbookIDE.compare;
  // The frame, at the compared size, and the area it scrolls in.
  const frame = elem.querySelector(".webide-frame");
  if (!frame) return null;

  // A page has no size of its own: the pages are compared at the frame's,
  // which the directive sets.
  const preview = frame.querySelector("iframe");
  const width = parseInt(preview?.style.width, 10) || 400;
  const height = parseInt(preview?.style.height, 10) || 300;
  const pass = Number(elem.getAttribute("data-pass") || 98);

  const comparison = createComparison({
    ide,
    pass,
    hint: hyperbook.i18n.get("webide-compare-hint"),
    overlay: frame,
    panelAfter: frame,
    observe: elem,
    // The solution page with the reader's other files, or a target image.
    drawTarget: async () => {
      const files = ide.files();
      const solution = files.find((file) => file.role === "solution");
      if (solution) {
        const solved = files.map((file) =>
          file.path === ide.main ? { ...file, content: solution.content ?? "" } : file,
        );
        return captureWebPage(comparison.offscreen, solved, ide.main, width, height);
      }
      const image = files.find((file) => file.role === "target");
      const img = await loadImage(image.url);
      return normalize(img, img.naturalWidth, img.naturalHeight, width, height);
    },
    drawOutput: () =>
      captureWebPage(comparison.offscreen, ide.files(), ide.main, width, height),
  });
  return comparison;
};
