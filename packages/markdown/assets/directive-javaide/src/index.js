/// <reference path="../../hyperbook.types.js" />

import { getExecutionState } from "./state.js";
import { executeEntries } from "./execution.js";
import { appendOutput, appendOutputLine, clearOutput } from "./output.js";
import { classNameOf } from "./constants.js";
import {
  getRunningInstanceId,
  handleStopClick,
  updateRunning,
} from "./ui.js";

/**
 * Java IDE with code execution in the browser (CheerpJ compiles and runs the
 * reader's Java on a worker).
 * @type {HyperbookJavaide}
 * @memberof hyperbook
 * @see hyperbook.store
 * @see hyperbook.i18n
 */
hyperbook.javaide = (function () {
  /** The report of a test run, in place of the raw output. */
  const renderTestReport = (output, entries, result) => {
    const passed = result.results.filter((r) => r && r.exitCode === 0).length;
    const total = entries.length;
    const report = document.createElement("div");
    report.className = "javaide-tests";
    report.setAttribute("data-status", passed === total ? "passed" : "failed");

    const summary = document.createElement("div");
    summary.className = "javaide-tests-summary";
    const title = document.createElement("span");
    title.className = "javaide-tests-title";
    title.textContent = hyperbook.i18n.get(
      passed === total ? "javaide-tests-all-passed" : "javaide-tests-some-passed",
      { total: String(total), passed: String(passed) },
    );
    summary.appendChild(title);
    report.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "javaide-tests-list";
    entries.forEach((entry, i) => {
      const r = result.results[i] || { exitCode: null, output: "" };
      const status = r.exitCode === 0 ? "passed" : "failed";
      const li = document.createElement("li");
      li.className = "javaide-test";
      li.setAttribute("data-status", status);
      const head = document.createElement("div");
      head.className = "javaide-test-head";
      const icon = document.createElement("span");
      icon.className = "javaide-test-icon";
      const name = document.createElement("span");
      name.className = "javaide-test-name";
      name.textContent = entry.label;
      const statusEl = document.createElement("span");
      statusEl.className = "javaide-test-status";
      statusEl.textContent = hyperbook.i18n.get(
        status === "passed" ? "javaide-test-passed" : "javaide-test-failed",
      );
      head.append(icon, name, statusEl);
      li.appendChild(head);
      if (r.output) {
        const out = document.createElement("pre");
        out.className = "javaide-test-output";
        out.textContent = r.output;
        li.appendChild(out);
      }
      list.appendChild(li);
    });
    report.appendChild(list);
    output.innerHTML = "";
    output.appendChild(report);
  };

  const init = (root) => {
    const elems = root.getElementsByClassName("directive-javaide");

    for (let elem of elems) {
      if (elem.getAttribute("data-javaide-initialized") === "true") continue;
      elem.setAttribute("data-javaide-initialized", "true");

      const editorDiv = elem.getElementsByClassName("editor")[0];
      const container = elem.getElementsByClassName("container")[0];
      const editorContainer =
        elem.getElementsByClassName("editor-container")[0];
      const splitter = elem.getElementsByClassName("splitter")[0];
      const run = elem.getElementsByClassName("run")[0];
      const test = elem.getElementsByClassName("test")[0];
      const stop = elem.getElementsByClassName("stop")[0];
      const output = elem.getElementsByClassName("output")[0];

      const copyEl = elem.getElementsByClassName("copy")[0];
      const resetEl = elem.getElementsByClassName("reset")[0];
      const downloadEl = elem.getElementsByClassName("download")[0];
      const fullscreenEl = elem.getElementsByClassName("fullscreen")[0];

      const id = elem.id;
      const ide = HyperbookIDE.mount(elem, {
        id,
        runtime: "javaide",
        editor: editorDiv,
        workspace: elem.getAttribute("data-workspace"),
        lang: (path) => (path.endsWith(".java") ? "java" : ""),
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

      const getTests = () => ide.files().filter((file) => file.role === "test");

      /** Runs the main class, or every test class, in the CheerpJ worker. */
      const runProgram = async (type) => {
        const state = getExecutionState(id);
        if (state.running || getRunningInstanceId() !== null) return;
        state.running = true;
        state.type = type;
        state.stopRequested = false;
        state.stopping = false;
        updateRunning();

        clearOutput(output);
        appendOutputLine(id, hyperbook.i18n.get("javaide-loading"));

        const files = ide.files();
        const entries =
          type === "test"
            ? getTests().map((f) => ({ className: classNameOf(f.path), label: f.path }))
            : [{ className: classNameOf(ide.main), label: ide.main }];

        let result;
        try {
          result = await executeEntries({ id, output, files, entries, state });
        } catch (e) {
          appendOutput(output, `Error: ${e}`, true);
          console.log(e);
          result = { stopped: false, compileFailed: false, error: String(e), results: [] };
        } finally {
          state.running = false;
          state.stopping = false;
          state.type = null;
          updateRunning();
        }

        if (result.stopped || result.error) {
          if (result.error) appendOutput(output, String(result.error), true);
          return;
        }
        if (type === "test" && !result.compileFailed) {
          renderTestReport(output, entries, result);
        }
      };

      run?.addEventListener("click", () => runProgram("run"));
      test?.addEventListener("click", () => runProgram("test"));
      stop?.addEventListener("click", handleStopClick);
    }
  };

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (
            node.nodeType === 1 &&
            node.classList?.contains("directive-javaide")
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
