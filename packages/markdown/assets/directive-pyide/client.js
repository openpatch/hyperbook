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

  class StdinHandler {
    constructor(results, options) {
      this.results = results;
      this.idx = 0;
      Object.assign(this, options);
    }

    stdin() {
      return this.results[this.idx++];
    }
  }

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

  const resetCanvas = (canvas) => {
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const executeScript = async (id, script, context = {}) => {
    const filename = "<exec>";
    try {
      const pyodide = await getRuntime(id);
      const { inputs = [], canvas, ...globalsContext } = context;

      if (canvas) {
        try {
          resetCanvas(canvas);
          pyodide.canvas.setCanvas2D(canvas);
        } catch (error) {
          appendOutputLine(id, `Canvas setup failed: ${error.message}`);
        }
      }

      pyodide.setStdin(new StdinHandler(inputs));
      pyodide.setStdout({
        batched: (msg) => appendOutputLine(id, msg),
      });
      pyodide.setStderr({
        batched: (msg) => appendOutputLine(id, msg),
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
    if (!state.running || state.stopRequested) return;
    state.stopRequested = true;
    state.stopping = true;
    appendOutputLine(id, "Stop requested. Finishing current execution...");
    updateRunning();
  };

  const handleStopClick = (event) => {
    const elem = event.currentTarget.closest(".directive-pyide");
    if (!elem?.id) return;
    requestStop(elem.id);
  };

  const updateRunning = () => {
    const elems = document.getElementsByClassName("directive-pyide");
    for (let elem of elems) {
      const run = elem.getElementsByClassName("run")[0];
      const test = elem.getElementsByClassName("test")[0];
      const state = getExecutionState(elem.id);

      run.removeEventListener("click", handleStopClick);
      test?.removeEventListener("click", handleStopClick);
      run.classList.remove("stopping");
      test?.classList.remove("stopping");

      if (state.running) {
        if (state.type === "run") {
          run.textContent = state.stopping
            ? "Stopping..."
            : hyperbook.i18n.get("pyide-running-click-to-stop");
          run.disabled = false;
          run.addEventListener("click", handleStopClick);
          run.classList.toggle("stopping", state.stopping);
          if (test) {
            test.classList.add("running");
            test.disabled = true;
          }
        } else if (state.type === "test" && test) {
          test.textContent = state.stopping
            ? "Stopping..."
            : hyperbook.i18n.get("pyide-testing-click-to-stop");
          test.disabled = false;
          test.addEventListener("click", handleStopClick);
          test.classList.toggle("stopping", state.stopping);
          run.classList.add("running");
          run.disabled = true;
        } else {
          run.classList.add("running");
          run.disabled = true;
          if (test) {
            test.classList.add("running");
            test.disabled = true;
          }
        }
      } else {
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
      }
    }
  };

  const setupSplitter = (elem, container, editorContainer, splitter) => {
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

    splitter.addEventListener("mousedown", (event) => {
      event.preventDefault();

      const isHorizontal = getIsHorizontal();
      const key = isHorizontal ? "splitHorizontal" : "splitVertical";
      const startPointer = isHorizontal ? event.clientX : event.clientY;
      const startSize = isHorizontal
        ? container.getBoundingClientRect().width
        : container.getBoundingClientRect().height;

      elem.classList.add("resizing");

      const onMouseMove = (moveEvent) => {
        const pointer = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
        const delta = pointer - startPointer;
        const size = applySplitSize(startSize + delta, isHorizontal);
        elem.dataset[key] = String(Math.round(size));
      };

      const onMouseUp = () => {
        elem.classList.remove("resizing");
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    window.addEventListener("resize", applyStoredSplitSize);
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
      const output = elem.getElementsByClassName("output")[0];
      const canvas = elem.getElementsByClassName("canvas")[0];
      const canvasWrapper = elem.getElementsByClassName("canvas-wrapper")[0] || canvas;
      const input = elem.getElementsByClassName("input")[0];
      const outputBtn = elem.getElementsByClassName("output-btn")[0];
      const canvasBtn = elem.getElementsByClassName("canvas-btn")[0];
      const inputBtn = elem.getElementsByClassName("input-btn")[0];

      const copyEl = elem.getElementsByClassName("copy")[0];
      const resetEl = elem.getElementsByClassName("reset")[0];
      const downloadEl = elem.getElementsByClassName("download")[0];

      const id = elem.id;
      const hasCanvas = elem.getAttribute("data-canvas") === "true";

      copyEl?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(editor.value);
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
        const blob = new Blob([editor.value], { type: "text/plain" });
        a.href = URL.createObjectURL(blob);
        a.download = `script-${id}.py`;
        a.click();
      });
      let tests = [];
      try {
        tests = JSON.parse(atob(elem.getAttribute("data-tests")));
      } catch (e) {}

      function showInput() {
        outputBtn.classList.remove("active");
        if (canvasBtn) canvasBtn.classList.remove("active");
        inputBtn.classList.add("active");
        output.classList.add("hidden");
        if (canvasWrapper) canvasWrapper.classList.add("hidden");
        input.classList.remove("hidden");
      }
      function showOutput() {
        outputBtn.classList.add("active");
        if (canvasBtn) canvasBtn.classList.remove("active");
        inputBtn.classList.remove("active");
        output.classList.remove("hidden");
        if (canvasWrapper) canvasWrapper.classList.add("hidden");
        input.classList.add("hidden");
      }
      function showCanvas() {
        outputBtn.classList.remove("active");
        if (canvasBtn) canvasBtn.classList.add("active");
        inputBtn.classList.remove("active");
        output.classList.add("hidden");
        if (canvasWrapper) canvasWrapper.classList.remove("hidden");
        input.classList.add("hidden");
      }

      outputBtn?.addEventListener("click", showOutput);
      canvasBtn?.addEventListener("click", showCanvas);
      inputBtn?.addEventListener("click", showInput);
      setupSplitter(elem, container, editorContainer, splitter);

      editor.addEventListener("code-input_load", async () => {
        const result = await hyperbook.store.db.pyide.get(id);
        if (result) {
          editor.value = result.script;
        }
      });

      editor.addEventListener("input", () => {
        hyperbook.store.db.pyide.put({ id, script: editor.value });
      });

      test?.addEventListener("click", async () => {
        showOutput();
        const state = getExecutionState(id);
        if (state.running) return;
        state.running = true;
        state.type = "test";
        state.stopRequested = false;
        state.stopping = false;
        updateRunning();

        output.innerHTML = "";

        const script = editor.value;
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
              output.textContent += results;
            } else if (error) {
              output.textContent += error;
            }
          }
        } catch (e) {
          output.textContent = `Error: ${e}`;
          console.log(e);
        } finally {
          state.running = false;
          state.stopping = false;
          state.type = null;
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
        if (state.running) return;
        state.running = true;
        state.type = "run";
        state.stopRequested = false;
        state.stopping = false;
        updateRunning();

        const script = editor.value;
        output.innerHTML = "";
        try {
          const { results, error } = await executeScript(id, script, {
            inputs: input.value.split("\n"),
            ...(hasCanvas && canvas ? { canvas } : {}),
          });
          if (!state.stopRequested) {
            if (results) {
              output.textContent += results;
            } else if (error) {
              output.textContent += error;
            }
          } else {
            appendOutputLine(id, "Execution stopped.");
          }
        } catch (e) {
          output.textContent = `Error: ${e}`;
          console.log(e);
        } finally {
          state.running = false;
          state.stopping = false;
          state.type = null;
          updateRunning();
        }
      });
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

  return { init };
})();
