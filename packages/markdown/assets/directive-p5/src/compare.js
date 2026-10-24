import { buildSketchPage, solutionFiles } from "./page.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Renders a sketch in a hidden frame and captures its canvas once the given
 * frame was drawn. A sketch without draw() is captured once it settled.
 *
 * The frame stays in the page while it renders: browsers throttle frames
 * that are display:none or far off screen.
 *
 * @returns {Promise<{canvas: HTMLCanvasElement, width: number, height: number}>}
 */
export const captureSketch = async (host, html, frame) => {
  const iframe = document.createElement("iframe");
  iframe.className = "p5-capture";
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  const loaded = new Promise((resolve) =>
    iframe.addEventListener("load", resolve, { once: true }),
  );
  iframe.srcdoc = html;
  host.appendChild(iframe);
  try {
    await loaded;
    const win = iframe.contentWindow;
    const started = Date.now();
    // Until the frame was drawn, or for a sketch that never loops, a while.
    while (Date.now() - started < 4000) {
      if ((win.frameCount ?? 0) > frame) break;
      if ((win.frameCount ?? 0) >= 1 && typeof win.draw !== "function") break;
      await sleep(30);
    }
    win.noLoop?.();
    const canvas = iframe.contentDocument.querySelector("canvas");
    if (!canvas) throw new Error("The sketch did not create a canvas.");
    // p5 draws at the screen's pixel density; compare in CSS pixels.
    const width = Number(win.width) || canvas.clientWidth || canvas.width;
    const height = Number(win.height) || canvas.clientHeight || canvas.height;
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext("2d").drawImage(canvas, 0, 0);
    return { canvas: copy, width, height };
  } finally {
    iframe.remove();
  }
};

/**
 * Graphic comparison for a p5 with `compare`: the target over the sketch and
 * a panel below it. Each Update scores the sketch: the caller calls
 * changed().
 */
export const setupComparison = (elem, ide, template) => {
  const { createComparison, normalize, loadImage } = HyperbookIDE.compare;
  const frameArea = elem.querySelector(".p5-frame");
  const sketch = frameArea?.querySelector("iframe");
  if (!frameArea || !sketch) return null;

  const pass = Number(elem.getAttribute("data-pass") || 98);
  const frame = Number(elem.getAttribute("data-frame") || 1);

  /** The size compared: the solution's whole canvas. */
  let dims = null;

  const comparison = createComparison({
    ide,
    pass,
    hint: hyperbook.i18n.get("p5-compare-hint"),
    overlay: frameArea,
    panelAfter: frameArea,
    // The sketch page centres its canvas, but at its own size: the target
    // goes where the reader's canvas is, from its top left, as compared.
    align: "center",
    locate: () => {
      const canvas = sketch.contentDocument?.querySelector("canvas");
      if (!canvas) return null;
      const frame = sketch.getBoundingClientRect();
      const box = canvas.getBoundingClientRect();
      const area = frameArea.getBoundingClientRect();
      return {
        x: frame.left + box.left - area.left,
        y: frame.top + box.top - area.top,
      };
    },
    observe: elem,
    drawTarget: async () => {
      const files = ide.files();
      const solved = solutionFiles(files, ide.main);
      let goal;
      if (solved) {
        goal = await captureSketch(
          comparison.offscreen,
          buildSketchPage(template, solved, ide.main, { seeded: true }),
          frame,
        );
      } else {
        const image = files.find((file) => file.role === "target");
        const img = await loadImage(image.url);
        goal = { canvas: img, width: img.naturalWidth, height: img.naturalHeight };
      }
      dims = [Math.round(goal.width), Math.round(goal.height)];
      return normalize(goal.canvas, goal.width, goal.height, ...dims);
    },
    drawOutput: async () => {
      const output = await captureSketch(
        comparison.offscreen,
        buildSketchPage(template, ide.files(), ide.main, { seeded: true }),
        frame,
      );
      return normalize(output.canvas, output.width, output.height, ...dims);
    },
  });
  // The canvas appears after the sketch's setup(), and moves when the sketch
  // scrolls, resizes its canvas or the panel is resized.
  sketch.addEventListener("load", () => {
    const win = sketch.contentWindow;
    let tries = 0;
    const wait = () => {
      comparison.realign();
      const canvas = sketch.contentDocument?.querySelector("canvas");
      if (canvas) {
        // resizeCanvas() moves a centred canvas.
        new ResizeObserver(comparison.realign).observe(canvas);
      } else if (tries++ < 120) {
        win?.requestAnimationFrame(wait);
      }
    };
    wait();
    win?.addEventListener("scroll", comparison.realign);
    win?.addEventListener("resize", comparison.realign);
  });
  return comparison;
};
