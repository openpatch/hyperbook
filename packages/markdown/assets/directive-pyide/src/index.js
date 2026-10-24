/// <reference path="../../hyperbook.types.js" />

import { turtleModules, interruptBuffers, getExecutionState } from "./state.js";
import {
  getOutput,
  appendOutput,
  appendFriendlyError,
  appendOutputLine,
  clearPytamaroStdoutCarry,
} from "./output.js";
import { executeScript } from "./execution.js";
import { turtleCompletions } from "./turtle-completions.js";
import { setupComparison } from "./compare.js";
import { runTests } from "./tests.js";
import {
  releaseKeyboardCapture,
  returnAfterReload,
  updateRunning,
  handleStopClick,
  getRunningInstanceId,
} from "./ui.js";

/**
 * Python IDE with code execution.
 * @type {HyperbookPython}
 * @memberof hyperbook
 * @see hyperbook.store
 * @see hyperbook.i18n
 */
hyperbook.python = (function () {
  const init = (root) => {
    const elems = root.getElementsByClassName("directive-pyide");

    for (let elem of elems) {
      if (elem.getAttribute("data-pyide-initialized") === "true") continue;
      elem.setAttribute("data-pyide-initialized", "true");

      const editorDiv = elem.getElementsByClassName("editor")[0];
      const container = elem.getElementsByClassName("container")[0];
      const editorContainer =
        elem.getElementsByClassName("editor-container")[0];
      const splitter = elem.getElementsByClassName("splitter")[0];
      const run = elem.getElementsByClassName("run")[0];
      const test = elem.getElementsByClassName("test")[0];
      const stop = elem.getElementsByClassName("stop")[0];
      const output = elem.getElementsByClassName("output")[0];
      const canvas = elem.getElementsByClassName("canvas")[0];
      const canvasWrapper =
        elem.getElementsByClassName("canvas-wrapper")[0] || canvas;
      const outputBtn = elem.getElementsByClassName("output-btn")[0];
      const canvasBtn = elem.getElementsByClassName("canvas-btn")[0];

      const copyEl = elem.getElementsByClassName("copy")[0];
      const resetEl = elem.getElementsByClassName("reset")[0];
      const downloadEl = elem.getElementsByClassName("download")[0];
      const fullscreenEl = elem.getElementsByClassName("fullscreen")[0];

      const id = elem.id;
      const hasCanvas = elem.getAttribute("data-canvas") === "true";
      const additionalPackages = Array.from(
        new Set(
          (elem.getAttribute("data-packages") || "")
            .split(",")
            .map((pkg) => pkg.trim())
            .filter((pkg) => pkg.length > 0),
        ),
      );
      const ide = HyperbookIDE.mount(elem, {
        id,
        runtime: "pyide",
        editor: editorDiv,
        workspace: elem.getAttribute("data-workspace"),
        lang: (path) => (path.endsWith(".py") ? "python" : ""),
        editorOptions: {
          completions: [turtleCompletions],
          // Python blocks are defined by indentation alone, so show where
          // each one starts and ends.
          indentGuides: true,
        },
        buttons: {
          reset: resetEl,
          copy: copyEl,
          download: downloadEl,
          fullscreen: fullscreenEl,
        },
        layout: { container, editorContainer, splitter },
      });
      // Store CM on the element so updateRunning() can toggle readOnly
      editorDiv._cm = ide.cm;

      const getMainScript = () => ide.content(ide.main) ?? "";
      const getTests = () => ide.files().filter((file) => file.role === "test");

      // Output and canvas share the panel as tabs. A run shows the canvas,
      // an error the output, where the message is.
      const showView = (view) => {
        if (!hasCanvas) return;
        const onCanvas = view === "canvas";
        outputBtn?.classList.toggle("active", !onCanvas);
        canvasBtn?.classList.toggle("active", onCanvas);
        output.classList.toggle("hidden", onCanvas);
        canvasWrapper.classList.toggle("hidden", !onCanvas);
        if (onCanvas) turtleModules.get(id)?.__redraw?.();
      };
      const showOutput = () => showView("output");
      const showCanvas = () => showView("canvas");

      outputBtn?.addEventListener("click", showOutput);
      canvasBtn?.addEventListener("click", showCanvas);
      window.addEventListener("resize", () => {
        turtleModules.get(id)?.__redraw?.();
      });
      // The canvas is the first tab, and open first.
      showView("canvas");

      // The page was reloaded to stop this IDE's script: back to where it was.
      if (returnAfterReload(elem)) {
        showOutput();
        appendOutputLine(id, "Execution stopped.");
      }

      test?.addEventListener("click", async () => {
        showOutput();
        const state = getExecutionState(id);
        if (state.running || getRunningInstanceId() !== null) return;
        state.running = true;
        state.type = "test";
        state.stopRequested = false;
        state.stopping = false;
        const interruptBuffer = interruptBuffers.get(id);
        if (interruptBuffer) interruptBuffer[0] = 0;
        updateRunning();

        output.innerHTML = "";
        clearPytamaroStdoutCarry(id);

        try {
          await runTests({
            id,
            output,
            tests: getTests(),
            script: getMainScript(),
            files: ide.files(),
            packages: additionalPackages,
            state,
          });
        } catch (e) {
          output.innerHTML = "";
          appendOutput(output, `Error: ${e}`, true);
          console.log(e);
        } finally {
          clearPytamaroStdoutCarry(id);
          state.running = false;
          state.stopping = false;
          state.type = null;
          releaseKeyboardCapture(id);
          updateRunning();
        }
      });

      /**
       * Runs the reader's program.
       * @returns whether it ran to its end, without an error or Stop (another
       *   program may also hold the runtime).
       */
      const runProgram = async () => {
        const script = getMainScript();
        const files = ide.files();
        if (hasCanvas) {
          showCanvas();
        } else {
          showOutput();
        }
        const state = getExecutionState(id);
        if (state.running || getRunningInstanceId() !== null) return false;
        state.running = true;
        state.type = "run";
        state.stopRequested = false;
        state.stopping = false;
        const interruptBuffer = interruptBuffers.get(id);
        if (interruptBuffer) interruptBuffer[0] = 0;
        updateRunning();

        output.innerHTML = "";
        clearPytamaroStdoutCarry(id);
        let completed = false;
        try {
          const { results, error } = await executeScript(
            id,
            script,
            {
              files,
              ...(hasCanvas && canvas ? { canvas } : {}),
            },
            additionalPackages,
          );
          if (!state.stopRequested) {
            if (results) {
              appendOutput(output, results, false, id);
            } else if (error) {
              showOutput();
              appendFriendlyError(output, error, script);
            }
          }
          // The turtle may still be drawing, or waiting for ontimer(). Until
          // it is done, the program counts as running, so Stop can end it.
          const turtle = turtleModules.get(id);
          if (turtle && !state.stopRequested) {
            state.finishing = true;
            await turtle.__whenIdle();
            state.finishing = false;
            turtle.__redraw();
          }
          if (state.stopRequested) {
            appendOutputLine(id, "Execution stopped.");
          }
          completed = !error && !state.stopRequested;
        } catch (e) {
          showOutput();
          output.innerHTML = "";
          appendOutput(output, `Error: ${e}`, true, id);
          console.log(e);
        } finally {
          clearPytamaroStdoutCarry(id);
          state.running = false;
          state.stopping = false;
          state.finishing = false;
          state.type = null;
          releaseKeyboardCapture(id);
          updateRunning();
        }
        return completed;
      };

      // With compare, every run that ends without an error is scored.
      const comparison = elem.hasAttribute("data-compare")
        ? setupComparison({
            elem,
            id,
            ide,
            canvas,
            canvasWrapper,
            packages: additionalPackages,
          })
        : null;

      run?.addEventListener("click", async () => {
        if ((await runProgram()) && comparison) await comparison.changed();
      });

      stop?.addEventListener("click", handleStopClick);
    }
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === 1 &&
            node.classList?.contains("directive-pyide")
          ) {
            init(node);
          }
        });
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });

  return { init };
})();
