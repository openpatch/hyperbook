import { executeScript } from "./execution.js";
import { getExecutionState, turtleModules } from "./state.js";
import { getRunningInstanceId, updateRunning } from "./ui.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A canvas's size in CSS pixels; the turtle draws at the screen's density. */
const logicalSize = (canvas) => [
  parseFloat(canvas.style.width) || canvas.clientWidth || canvas.width,
  parseFloat(canvas.style.height) || canvas.clientHeight || canvas.height,
];

/** A copy of a canvas, so a later run does not change what was compared. */
const snapshot = (canvas) => {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d").drawImage(canvas, 0, 0);
  const [width, height] = logicalSize(canvas);
  return { canvas: copy, width, height };
};

/**
 * Graphic comparison for a pyide with `compare`: the target over the canvas
 * and a panel below it. Each run that ends without an error is scored: the
 * caller calls changed() after it.
 *
 * The target is drawn once the IDE is in sight: drawing it means loading
 * Python.
 */
export const setupComparison = ({
  elem,
  id,
  ide,
  canvas,
  canvasWrapper,
  packages,
}) => {
  const { createComparison, normalize, loadImage } = HyperbookIDE.compare;
  const pass = Number(elem.getAttribute("data-pass") || 98);

  /** The size compared: the whole canvas of the solution. */
  let dims = null;

  // The solution draws here, unseen.
  const hidden = document.createElement("canvas");
  hidden.className = "canvas compare-solution-canvas";

  const comparison = createComparison({
    ide,
    pass,
    hint: hyperbook.i18n.get("pyide-compare-hint"),
    overlay: canvasWrapper,
    panelAfter: canvasWrapper,
    observe: elem,
    drawTarget: async () => {
      if (!hidden.isConnected) comparison.offscreen.appendChild(hidden);
      const files = ide.files();
      const solution = files.find((file) => file.role === "solution");
      let goal;
      if (solution) {
        // One program runs at a time on the page: wait for others, e.g. the
        // target of another pyide drawn as it came into view. Checking and
        // taking the lock happen in one go, so two cannot start together.
        while (getExecutionState(id).running || getRunningInstanceId() !== null) {
          await sleep(200);
        }
        const state = getExecutionState(id);
        state.running = true;
        state.type = "run";
        state.stopRequested = false;
        updateRunning();
        try {
          const { error } = await executeScript(
            id,
            solution.content ?? "",
            { files, canvas: hidden, quiet: true },
            packages,
          );
          if (error) {
            throw new Error(hyperbook.i18n.get("ide-compare-solution-failed"));
          }
          await turtleModules.get(id)?.__whenIdle();
          turtleModules.get(id)?.__redraw();
          goal = snapshot(hidden);
        } finally {
          state.running = false;
          state.type = null;
          updateRunning();
        }
      } else {
        const image = files.find((file) => file.role === "target");
        const img = await loadImage(image.url);
        goal = { canvas: img, width: img.naturalWidth, height: img.naturalHeight };
      }
      dims = [Math.round(goal.width), Math.round(goal.height)];
      return normalize(goal.canvas, goal.width, goal.height, ...dims, {
        centered: true,
      });
    },
    // What the run just drew on the canvas.
    drawOutput: async () => {
      const output = snapshot(canvas);
      return normalize(output.canvas, output.width, output.height, ...dims, {
        centered: true,
      });
    },
  });

  return comparison;
};
