/// <reference path="../hyperbook.types.js" />

/**
 * Python IDE with code execution.
 * @type {HyperbookPython}
 * @memberof hyperbook
 * @see hyperbook.store
 * @see hyperbook.i18n
 */
hyperbook.python = (function () {
  window.codeInput?.registerTemplate(
    "pyide-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.AutoCloseBrackets(),
      new codeInput.plugins.Indent(true, 2),
    ])
  );

  const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.29.4/full/pyodide.js";

  const loadPyodideScript = () => {
    if (window.loadPyodide) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PYODIDE_CDN;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Pyodide"));
      document.head.appendChild(script);
    });
  };

  const pyodideReadyPromise = (async () => {
    await loadPyodideScript();
    return window.loadPyodide;
  })();

  /**
   * @type {Map<string, any>}
   */
  const runtimes = new Map();

  /**
   * @type {Map<string, { running: boolean, stopping: boolean, stopRequested: boolean, type: "run" | "test" | null }>}
   */
  const executionStates = new Map();
  /**
   * @type {Map<string, Int32Array>}
   */
  const interruptBuffers = new Map();

  const getExecutionState = (id) => {
    if (!executionStates.has(id)) {
      executionStates.set(id, {
        running: false,
        stopping: false,
        stopRequested: false,
        type: null,
      });
    }
    return executionStates.get(id);
  };

  const getRuntime = async (id) => {
    if (runtimes.has(id)) {
      return runtimes.get(id);
    }
    const loadPyodide = await pyodideReadyPromise;
    const pyodide = await loadPyodide();
    if (
      typeof SharedArrayBuffer !== "undefined" &&
      window.crossOriginIsolated &&
      typeof pyodide.setInterruptBuffer === "function"
    ) {
      const interruptBuffer = new Int32Array(new SharedArrayBuffer(4));
      pyodide.setInterruptBuffer(interruptBuffer);
      interruptBuffers.set(id, interruptBuffer);
    }
    runtimes.set(id, pyodide);
    return pyodide;
  };

  const getOutput = (id) => {
    return document.getElementById(id)?.getElementsByClassName("output")[0];
  };

  const appendOutputLine = (id, message) => {
    const output = getOutput(id);
    if (!output) return;
    output.appendChild(document.createTextNode(message + "\n"));
  };

  const appendOutputErrorLine = (id, message) => {
    const output = getOutput(id);
    if (!output) return;
    const line = document.createElement("span");
    line.classList.add("error-line");
    line.textContent = message + "\n";
    output.appendChild(line);
  };

  const appendOutput = (output, message, isError = false) => {
    if (!output || message === undefined || message === null) return;
    if (isError) {
      const line = document.createElement("span");
      line.classList.add("error-line");
      line.textContent = String(message);
      output.appendChild(line);
      return;
    }
    output.appendChild(document.createTextNode(String(message)));
  };

  const updateFullscreenButtonState = (elem, button) => {
    if (!elem || !button) return;
    const isFullscreen = document.fullscreenElement === elem;
    button.textContent = hyperbook.i18n.get(
      isFullscreen ? "ide-fullscreen-exit" : "ide-fullscreen-enter",
    );
    button.classList.toggle("active", isFullscreen);
  };

  const toggleFullscreen = async (elem) => {
    if (!elem) return;
    if (document.fullscreenElement === elem) {
      await document.exitFullscreen();
      return;
    }
    await elem.requestFullscreen();
  };

  const syncFullscreenButtons = () => {
    const elems = document.getElementsByClassName("directive-pyide");
    for (const elem of elems) {
      const fullscreen = elem.getElementsByClassName("fullscreen")[0];
      updateFullscreenButtonState(elem, fullscreen);
    }
  };

  const releaseKeyboardCapture = (id) => {
    const elem = document.getElementById(id);
    if (!elem) return;
    const canvas = elem.getElementsByClassName("canvas")[0];
    const editor = elem.getElementsByClassName("editor")[0];
    document.activeElement?.blur?.();
    canvas?.blur?.();
    window.setTimeout(() => {
      editor?.focus?.();
    }, 0);
  };

  const resetCanvas = (canvas) => {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const executeScript = async (id, script, context = {}) => {
    const filename = "<exec>";
    try {
      const pyodide = await getRuntime(id);
      const { canvas, ...globalsContext } = context;

      if (canvas) {
        try {
          resetCanvas(canvas);
          pyodide.canvas.setCanvas2D(canvas);
        } catch (error) {
          appendOutputErrorLine(id, `Canvas setup failed: ${error.message}`);
        }
      }

      pyodide.setStdin({
        stdin: () => {
          const value = window.prompt(hyperbook.i18n.get("pyide-input-prompt"));
          if (value === null) {
            return "";
          }
          return value;
        },
      });
      pyodide.setStdout({
        batched: (msg) => appendOutputLine(id, msg),
      });
      pyodide.setStderr({
        batched: (msg) => appendOutputErrorLine(id, msg),
      });

      await pyodide.loadPackagesFromImports(script);
      const dict = pyodide.globals.get("dict");
      const globals = dict();
      try {
        for (const [key, value] of Object.entries(globalsContext)) {
          globals.set(key, value);
        }
        const results = await pyodide.runPythonAsync(script, {
          globals,
          locals: globals,
          filename,
        });
        return { results };
      } finally {
        globals.destroy();
        dict.destroy();
      }
    } catch (error) {
      let message = error.message;
      if (message.startsWith("Traceback")) {
        const lines = message?.split("\n") || [];
        const i = lines.findIndex((line) => line.includes(filename));
        message = lines[0] + "\n" + lines.slice(i).join("\n");
      }
      return { error: message };
    }
  };

  const requestStop = (id) => {
    const state = getExecutionState(id);
    const hasRuntime = runtimes.has(id);
    if ((!state.running && !hasRuntime) || state.stopRequested) return;
    state.stopRequested = true;
    state.stopping = true;
    const interruptBuffer = interruptBuffers.get(id);
    if (interruptBuffer) {
      interruptBuffer[0] = 2;
      appendOutputLine(id, "Stop requested. Interrupting execution...");
    } else {
      appendOutputLine(id, hyperbook.i18n.get("pyide-stop-reloading"));
    }
    releaseKeyboardCapture(id);
    updateRunning();
    if (!interruptBuffer) {
      window.setTimeout(() => {
        window.location.reload();
      }, 50);
    }
  };

  const handleStopClick = (event) => {
    const elem = event.currentTarget.closest(".directive-pyide");
    if (!elem?.id) return;
    requestStop(elem.id);
  };

  const getRunningInstanceId = () => {
    const elems = document.getElementsByClassName("directive-pyide");
    for (const elem of elems) {
      if (getExecutionState(elem.id).running) {
        return elem.id;
      }
    }
    return null;
  };

  const updateRunning = () => {
    const runningInstanceId = getRunningInstanceId();
    const elems = document.getElementsByClassName("directive-pyide");
    for (let elem of elems) {
      const run = elem.getElementsByClassName("run")[0];
      const test = elem.getElementsByClassName("test")[0];
      const stop = elem.getElementsByClassName("stop")[0];
      const editor = elem.getElementsByClassName("editor")[0];
      const editorTextarea = editor?.querySelector("textarea");
      const state = getExecutionState(elem.id);
      const hasRuntime = runtimes.has(elem.id);
      const hasInterrupt = interruptBuffers.has(elem.id);
      const lockedByOther =
        runningInstanceId !== null &&
        runningInstanceId !== elem.id &&
        !state.running;

      stop?.removeEventListener("click", handleStopClick);
      run.classList.remove("stopping");
      run.classList.remove("locked");
      test?.classList.remove("stopping");
      test?.classList.remove("locked");
      stop?.classList.remove("stopping");
      elem.classList.toggle("locked-by-other", lockedByOther);

      if (state.running || lockedByOther) {
        editor?.setAttribute("disabled", "");
        editor?.classList.add("running");
        if (editorTextarea) {
          editorTextarea.readOnly = true;
        }
        if (state.running && state.type === "run") {
          run.textContent = hyperbook.i18n.get("pyide-running");
          run.disabled = true;
          run.classList.add("running");
          if (test) {
            test.classList.add("running");
            test.disabled = true;
          }
        } else if (state.running && state.type === "test" && test) {
          test.textContent = hyperbook.i18n.get("pyide-testing");
          test.disabled = true;
          test.classList.add("running");
          run.classList.add("running");
          run.disabled = true;
        } else {
          const lockLabel = lockedByOther
            ? "pyide-locked-other-instance-running"
            : "pyide-run";
          run.textContent = hyperbook.i18n.get(lockLabel);
          run.classList.add("running");
          run.classList.toggle("locked", lockedByOther);
          run.disabled = true;
          if (test) {
            test.textContent = hyperbook.i18n.get(
              lockedByOther ? "pyide-locked-other-instance-running" : "pyide-test",
            );
            test.classList.toggle("locked", lockedByOther);
            test.classList.add("running");
            test.disabled = true;
          }
        }

        if (stop) {
          const stopLabel = hasInterrupt ? "pyide-stop" : "pyide-stop-refresh";
          if (state.running) {
            stop.textContent = state.stopping
              ? hyperbook.i18n.get("pyide-stopping")
              : hyperbook.i18n.get(stopLabel);
            stop.disabled = false;
            stop.addEventListener("click", handleStopClick);
          } else {
            stop.textContent = hyperbook.i18n.get(stopLabel);
            stop.disabled = true;
          }
          stop.classList.toggle("stopping", state.stopping);
        }
      } else {
        editor?.removeAttribute("disabled");
        editor?.classList.remove("running");
        if (editorTextarea) {
          editorTextarea.readOnly = false;
        }
        run.classList.remove("stopping");
        run.classList.remove("running");
        run.textContent = hyperbook.i18n.get("pyide-run");
        run.disabled = false;
        if (test) {
          test.classList.remove("stopping");
          test.classList.remove("running");
          test.textContent = hyperbook.i18n.get("pyide-test");
          test.disabled = false;
        }
        if (stop) {
          stop.classList.remove("stopping");
          stop.classList.remove("running");
          stop.textContent = hyperbook.i18n.get(
            hasInterrupt ? "pyide-stop" : "pyide-stop-refresh",
          );
          stop.disabled = !hasRuntime;
          if (hasRuntime) {
            stop.addEventListener("click", handleStopClick);
          }
        }
      }
    }
  };

  const setupSplitter = (
    elem,
    container,
    editorContainer,
    splitter,
    onSplitChanged,
  ) => {
    if (!container || !editorContainer || !splitter) return;

    const minPanelSize = 120;

    const getIsHorizontal = () =>
      getComputedStyle(elem).flexDirection.startsWith("row");

    const applySplitSize = (rawSize, isHorizontal) => {
      const total = isHorizontal ? elem.clientWidth : elem.clientHeight;
      const splitterSize = isHorizontal ? splitter.offsetWidth : splitter.offsetHeight;
      const maxSize = Math.max(
        minPanelSize,
        total - splitterSize - minPanelSize
      );
      const clamped = Math.max(minPanelSize, Math.min(rawSize, maxSize));
      container.style.flex = `0 0 ${clamped}px`;
      return clamped;
    };

    const applyStoredSplitSize = () => {
      const isHorizontal = getIsHorizontal();
      elem.classList.toggle("split-horizontal", isHorizontal);
      elem.classList.toggle("split-vertical", !isHorizontal);
      const key = isHorizontal ? "splitHorizontal" : "splitVertical";
      const rawStored = Number(elem.dataset[key]);
      if (!Number.isFinite(rawStored) || rawStored <= 0) {
        container.style.flex = "";
        return;
      }
      applySplitSize(rawStored, isHorizontal);
    };

    applyStoredSplitSize();

    splitter.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      splitter.setPointerCapture(event.pointerId);

      const isHorizontal = getIsHorizontal();
      const key = isHorizontal ? "splitHorizontal" : "splitVertical";
      const startPointer = isHorizontal ? event.clientX : event.clientY;
      const startSize = isHorizontal
        ? container.getBoundingClientRect().width
        : container.getBoundingClientRect().height;

      elem.classList.add("resizing");

      const onPointerMove = (moveEvent) => {
        const pointer = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
        const delta = pointer - startPointer;
        const size = applySplitSize(startSize + delta, isHorizontal);
        elem.dataset[key] = String(Math.round(size));
      };

      const onPointerUp = () => {
        elem.classList.remove("resizing");
        splitter.removeEventListener("pointermove", onPointerMove);
        splitter.removeEventListener("pointerup", onPointerUp);
        splitter.removeEventListener("pointercancel", onPointerUp);
        const splitHorizontal = Number(elem.dataset.splitHorizontal);
        const splitVertical = Number(elem.dataset.splitVertical);
        onSplitChanged?.({
          ...(Number.isFinite(splitHorizontal) && splitHorizontal > 0
            ? { splitHorizontal: Math.round(splitHorizontal) }
            : {}),
          ...(Number.isFinite(splitVertical) && splitVertical > 0
            ? { splitVertical: Math.round(splitVertical) }
            : {}),
        });
      };

      splitter.addEventListener("pointermove", onPointerMove);
      splitter.addEventListener("pointerup", onPointerUp);
      splitter.addEventListener("pointercancel", onPointerUp);
    });

    window.addEventListener("resize", applyStoredSplitSize);
    return applyStoredSplitSize;
  };

  const setupCanvasOutputSplitter = (
    elem,
    container,
    canvasWrapper,
    output,
    splitter,
    onSplitChanged,
  ) => {
    if (!elem || !container || !canvasWrapper || !output || !splitter) return;

    const minPanelSize = 80;

    const getAvailableHeight = () => {
      const tabs = container.querySelector(".buttons");
      const tabsHeight = tabs && tabs.offsetParent !== null ? tabs.offsetHeight : 0;
      return container.clientHeight - tabsHeight - splitter.offsetHeight;
    };

    const applySplitSize = (rawSize) => {
      const total = getAvailableHeight();
      const maxSize = Math.max(minPanelSize, total - minPanelSize);
      const clamped = Math.max(minPanelSize, Math.min(rawSize, maxSize));
      canvasWrapper.style.flex = `0 0 ${clamped}px`;
      output.style.flex = "1 1 0";
      return clamped;
    };

    const applyStoredSplitSize = () => {
      const rawStored = Number(elem.dataset.splitCanvasOutput);
      if (!Number.isFinite(rawStored) || rawStored <= 0) {
        canvasWrapper.style.flex = "1 1 0";
        output.style.flex = "1 1 0";
        return;
      }
      applySplitSize(rawStored);
    };

    splitter.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      splitter.setPointerCapture(event.pointerId);

      const startPointer = event.clientY;
      const startSize = canvasWrapper.getBoundingClientRect().height;

      elem.classList.add("resizing");

      const onPointerMove = (moveEvent) => {
        const delta = moveEvent.clientY - startPointer;
        const size = applySplitSize(startSize + delta);
        elem.dataset.splitCanvasOutput = String(Math.round(size));
      };

      const onPointerUp = () => {
        elem.classList.remove("resizing");
        splitter.removeEventListener("pointermove", onPointerMove);
        splitter.removeEventListener("pointerup", onPointerUp);
        splitter.removeEventListener("pointercancel", onPointerUp);
        const splitCanvasOutput = Number(elem.dataset.splitCanvasOutput);
        if (Number.isFinite(splitCanvasOutput) && splitCanvasOutput > 0) {
          onSplitChanged?.({ splitCanvasOutput: Math.round(splitCanvasOutput) });
        }
      };

      splitter.addEventListener("pointermove", onPointerMove);
      splitter.addEventListener("pointerup", onPointerUp);
      splitter.addEventListener("pointercancel", onPointerUp);
    });

    window.addEventListener("resize", applyStoredSplitSize);
    return applyStoredSplitSize;
  };

  const init = (root) => {
    const elems = root.getElementsByClassName("directive-pyide");

    for (let elem of elems) {
      if (elem.getAttribute("data-pyide-initialized") === "true") continue;
      elem.setAttribute("data-pyide-initialized", "true");

      const editor = elem.getElementsByClassName("editor")[0];
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
      let pyideState = { id };

      const getEditorValue = () => {
        const textarea = editor?.querySelector("textarea");
        if (textarea) return textarea.value;
        return typeof editor?.textContent === "string" ? editor.textContent : "";
      };

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

      editor.addEventListener("code-input_load", async () => {
        const result = await hyperbook.store.db.pyide.get(id);
        if (result) {
          pyideState = { ...pyideState, ...result };
          if (typeof result.script === "string") {
            editor.value = result.script;
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
      });

      window.addEventListener("resize", applyCanvasOutputLayout);
      applyCanvasOutputLayout();

      editor.addEventListener("input", () => {
        void persistPyideState({ script: getEditorValue() });
      });

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

            const { results, error } = await executeScript(id, testCode, {});
            if (results) {
              appendOutput(output, results);
            } else if (error) {
              appendOutput(output, error, true);
            }
          }
        } catch (e) {
          output.innerHTML = "";
          appendOutput(output, `Error: ${e}`, true);
          console.log(e);
        } finally {
          state.running = false;
          state.stopping = false;
          state.type = null;
          releaseKeyboardCapture(id);
          updateRunning();
        }
      });

      run?.addEventListener("click", async () => {
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

        const script = getEditorValue();
        output.innerHTML = "";
        try {
          const { results, error } = await executeScript(id, script, {
            ...(hasCanvas && canvas ? { canvas } : {}),
          });
          if (!state.stopRequested) {
            if (results) {
              appendOutput(output, results);
            } else if (error) {
              showOutput();
              appendOutput(output, error, true);
            }
          } else {
            appendOutputLine(id, "Execution stopped.");
          }
        } catch (e) {
          showOutput();
          output.innerHTML = "";
          appendOutput(output, `Error: ${e}`, true);
          console.log(e);
        } finally {
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
