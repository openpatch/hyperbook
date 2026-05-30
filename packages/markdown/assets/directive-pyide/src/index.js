/// <reference path="../../hyperbook.types.js" />

import { turtleModules, interruptBuffers, getExecutionState } from "./state.js";
import {
  getOutput,
  appendOutput,
  appendFriendlyError,
  appendOutputLine,
  clearPytamaroStdoutCarry,
  setPytamaroCanvasTarget,
} from "./output.js";
import { executeScript } from "./execution.js";
import {
  updateFullscreenButtonState,
  toggleFullscreen,
  syncFullscreenButtons,
  releaseKeyboardCapture,
  updateRunning,
  handleStopClick,
  getRunningInstanceId,
  setupSplitter,
  setupCanvasOutputSplitter,
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
      const editorContainer = elem.getElementsByClassName("editor-container")[0];
      const splitter = elem.getElementsByClassName("splitter")[0];
      const run = elem.getElementsByClassName("run")[0];
      const test = elem.getElementsByClassName("test")[0];
      const stop = elem.getElementsByClassName("stop")[0];
      const output = elem.getElementsByClassName("output")[0];
      const canvas = elem.getElementsByClassName("canvas")[0];
      const canvasWrapper = elem.getElementsByClassName("canvas-wrapper")[0] || canvas;
      const canvasOutputSplitter = elem.getElementsByClassName("canvas-output-splitter")[0];
      const canvasHeader = elem.getElementsByClassName("canvas-header")[0];
      const outputHeader = elem.getElementsByClassName("output-header")[0];
      const outputBtn = elem.getElementsByClassName("output-btn")[0];
      const canvasBtn = elem.getElementsByClassName("canvas-btn")[0];
      const canvasTabs = outputBtn?.closest(".buttons");

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
      const hasPytamaroPackage = additionalPackages.some(
        (pkg) => pkg.toLowerCase() === "pytamaro",
      );
      const scriptLooksLikePytamaro = (script) => {
        return /\bfrom\s+pytamaro\s+import\b|\bimport\s+pytamaro\b/.test(script);
      };
      let pyideState = { id };

      // Initialize CodeMirror
      const initialSource = editorDiv ? editorDiv.textContent : "";
      if (editorDiv) editorDiv.textContent = "";
      const cm = editorDiv ? HyperbookCM.create(editorDiv, {
        lang: editorDiv.dataset.lang || "python",
        value: initialSource,
        onChange: (code) => {
          void persistPyideState({ script: code });
        },
      }) : null;
      // Store CM on the element so updateRunning() can toggle readOnly
      if (editorDiv && cm) editorDiv._cm = cm;

      const getEditorValue = () => cm?.getValue() ?? "";

      pyideState = { ...pyideState, script: getEditorValue() };

      const persistPyideState = (updates = {}) => {
        pyideState = { ...pyideState, ...updates, id };
        return hyperbook.store.db.pyide.put(pyideState);
      };

      copyEl?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(getEditorValue());
        } catch (error) {
          console.error(error.message);
        }
      });

      resetEl?.addEventListener("click", () => {
        hyperbook.store.db.pyide.delete(id);
        window.location.reload();
      });

      downloadEl?.addEventListener("click", () => {
        const a = document.createElement("a");
        const blob = new Blob([getEditorValue()], { type: "text/plain" });
        a.href = URL.createObjectURL(blob);
        a.download = `script-${id}.py`;
        a.click();
      });

      fullscreenEl?.addEventListener("click", async () => {
        try {
          await toggleFullscreen(elem);
        } catch (error) {
          console.error(error.message);
        }
      });
      updateFullscreenButtonState(elem, fullscreenEl);
      let tests = [];
      try {
        tests = JSON.parse(atob(elem.getAttribute("data-tests")));
      } catch (e) {}

      const isWideCanvasMode = () =>
        hasCanvas && window.matchMedia("(min-width: 1024px)").matches;

      let activeCanvasView = "output";

      const showOutputTab = () => {
        activeCanvasView = "output";
        outputBtn.classList.add("active");
        if (canvasBtn) canvasBtn.classList.remove("active");
        canvasHeader?.classList.add("hidden");
        outputHeader?.classList.add("hidden");
        output.classList.remove("hidden");
        if (canvasWrapper) canvasWrapper.classList.add("hidden");
        canvasOutputSplitter?.classList.add("hidden");
      };
      const showCanvasTab = () => {
        activeCanvasView = "canvas";
        outputBtn.classList.remove("active");
        if (canvasBtn) canvasBtn.classList.add("active");
        canvasHeader?.classList.add("hidden");
        outputHeader?.classList.add("hidden");
        output.classList.add("hidden");
        if (canvasWrapper) canvasWrapper.classList.remove("hidden");
        canvasOutputSplitter?.classList.add("hidden");
        turtleModules.get(id)?.__redraw?.();
      };

      const applyStoredCanvasOutputSplit = setupCanvasOutputSplitter(
        elem,
        container,
        canvasWrapper,
        output,
        canvasOutputSplitter,
        (splitState) => {
          void persistPyideState(splitState);
        },
      );

      const applyCanvasOutputLayout = () => {
        if (!hasCanvas || !canvasWrapper || !canvasOutputSplitter) return;
        if (isWideCanvasMode()) {
          elem.classList.add("canvas-split-mode");
          canvasTabs?.classList.add("hidden");
          output.classList.remove("hidden");
          canvasWrapper.classList.remove("hidden");
          canvasOutputSplitter.classList.remove("hidden");
          canvasHeader?.classList.remove("hidden");
          outputHeader?.classList.remove("hidden");
          outputBtn.classList.add("active");
          outputBtn.disabled = true;
          if (canvasBtn) {
            canvasBtn.classList.add("active");
            canvasBtn.disabled = true;
          }
          applyStoredCanvasOutputSplit?.();
          turtleModules.get(id)?.__redraw?.();
          return;
        }

        elem.classList.remove("canvas-split-mode");
        canvasTabs?.classList.remove("hidden");
        output.style.flex = "";
        canvasWrapper.style.flex = "";
        outputBtn.disabled = false;
        if (canvasBtn) {
          canvasBtn.disabled = false;
        }
        if (activeCanvasView === "canvas") {
          showCanvasTab();
        } else {
          showOutputTab();
        }
      };

      function showOutput() {
        if (isWideCanvasMode()) {
          applyCanvasOutputLayout();
          return;
        }
        showOutputTab();
      }
      function showCanvas() {
        if (isWideCanvasMode()) {
          applyCanvasOutputLayout();
          return;
        }
        showCanvasTab();
      }

      outputBtn?.addEventListener("click", showOutput);
      canvasBtn?.addEventListener("click", showCanvas);
      const applyStoredSplitSize = setupSplitter(
        elem,
        container,
        editorContainer,
        splitter,
        (splitState) => {
          void persistPyideState(splitState);
        },
      );

      let editorStateRestored = false;
      const restoreEditorState = async () => {
        if (editorStateRestored) return;
        editorStateRestored = true;

        const result = await hyperbook.store.db.pyide.get(id);
        if (result) {
          pyideState = { ...pyideState, ...result };
          if (typeof result.script === "string") {
            cm?.setValue(result.script);
          }
          if (
            Number.isFinite(result.splitHorizontal) &&
            result.splitHorizontal > 0
          ) {
            elem.dataset.splitHorizontal = String(Math.round(result.splitHorizontal));
          }
          if (
            Number.isFinite(result.splitVertical) &&
            result.splitVertical > 0
          ) {
            elem.dataset.splitVertical = String(Math.round(result.splitVertical));
          }
          if (
            Number.isFinite(result.splitCanvasOutput) &&
            result.splitCanvasOutput > 0
          ) {
            elem.dataset.splitCanvasOutput = String(
              Math.round(result.splitCanvasOutput),
            );
          }
          applyStoredSplitSize?.();
          applyCanvasOutputLayout();
        }
      };

      void restoreEditorState();

      window.addEventListener("resize", () => {
        applyCanvasOutputLayout();
        turtleModules.get(id)?.__redraw?.();
      });
      applyCanvasOutputLayout();

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

        const script = getEditorValue();
        try {
          for (let test of tests) {
            if (state.stopRequested) {
              appendOutputLine(id, "Stopped pending test execution.");
              break;
            }

            const testCode = test.code.replace("#SCRIPT#", script);

            const heading = document.createElement("div");
            heading.innerHTML = `== Test ${test.name} ==`;
            heading.classList.add("test-heading");
            output.appendChild(heading);

            const { results, error } = await executeScript(
              id,
              testCode,
              {},
              additionalPackages,
            );
            if (results) {
              appendOutput(output, results);
            } else if (error) {
              appendFriendlyError(output, error, testCode);
            }
          }
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

      run?.addEventListener("click", async () => {
        const script = getEditorValue();
        const usesPytamaro = hasPytamaroPackage || scriptLooksLikePytamaro(script);
        const renderPytamaroToCanvas = hasCanvas && canvas && usesPytamaro;
        if (hasCanvas) {
          showCanvas();
        } else {
          showOutput();
        }
        const state = getExecutionState(id);
        if (state.running || getRunningInstanceId() !== null) return;
        state.running = true;
        state.type = "run";
        state.stopRequested = false;
        state.stopping = false;
        const interruptBuffer = interruptBuffers.get(id);
        if (interruptBuffer) interruptBuffer[0] = 0;
        updateRunning();

        output.innerHTML = "";
        clearPytamaroStdoutCarry(id);
        try {
          setPytamaroCanvasTarget(id, renderPytamaroToCanvas);
          const { results, error } = await executeScript(id, script, {
            ...(hasCanvas && canvas ? { canvas } : {}),
          }, additionalPackages);
          if (!state.stopRequested) {
            if (results) {
              appendOutput(output, results, false, id);
            } else if (error) {
              showOutput();
              appendFriendlyError(output, error, script);
            }
          } else {
            appendOutputLine(id, "Execution stopped.");
          }
        } catch (e) {
          showOutput();
          output.innerHTML = "";
          appendOutput(output, `Error: ${e}`, true, id);
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

      stop?.addEventListener("click", handleStopClick);
    }
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.type === 1 && node.classList?.contains("directive-pyide")) {
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
  document.addEventListener("fullscreenchange", syncFullscreenButtons);

  return { init };
})();
