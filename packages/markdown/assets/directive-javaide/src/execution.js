import { getWorker } from "./cheerpj.js";
import { appendOutput, appendOutputLine } from "./output.js";

let runCounter = 0;

/** Ends the run: detaches from the worker and resolves its promise. */
export const finishRun = (state, result) => {
  if (state.worker && state.onMessage) {
    state.worker.removeEventListener("message", state.onMessage);
  }
  state.worker = null;
  state.onMessage = null;
  state.runId = null;
  const resolve = state.resolve;
  state.resolve = null;
  resolve?.(result);
};

/**
 * Compiles the workspace in the CheerpJ worker and runs the entry classes (the
 * main class, or every test class) one after another, streaming the Java
 * console to the output panel.
 *
 * @returns a promise for `{ stopped, compileFailed, error, results }`, where
 *   results[i] is `{ exitCode, output }` of entries[i].
 */
export const executeEntries = ({ id, output, files, entries, state }) => {
  const runId = `${id}-${Date.now()}-${++runCounter}`;
  state.runId = runId;
  const results = entries.map(() => ({ exitCode: null, output: "" }));
  return new Promise((resolve) => {
    state.resolve = resolve;
    const worker = getWorker();
    state.worker = worker;
    const onMessage = (event) => {
      const msg = event.data;
      if (!msg || msg.runId !== runId) return;
      switch (msg.type) {
        case "output":
          appendOutput(output, msg.text, msg.stream === "err");
          if (typeof msg.entry === "number" && results[msg.entry]) {
            results[msg.entry].output += msg.text;
          }
          break;
        case "compile-done":
          if (msg.exitCode !== 0) {
            appendOutputLine(id, hyperbook.i18n.get("javaide-compile-failed"), true);
          }
          break;
        case "entry-done":
          if (results[msg.index]) results[msg.index].exitCode = msg.exitCode;
          break;
        case "all-done":
          finishRun(state, {
            stopped: state.stopRequested,
            compileFailed: false,
            error: null,
            results,
          });
          break;
        case "error":
          finishRun(state, {
            stopped: state.stopRequested,
            compileFailed: false,
            error: msg.text,
            results,
          });
          break;
      }
    };
    state.onMessage = onMessage;
    worker.addEventListener("message", onMessage);
    worker.postMessage({
      type: "run",
      runId,
      files: files.map((f) => ({ path: f.path, content: f.content, url: f.url })),
      entries: entries.map((e) => ({ className: e.className, label: e.label })),
    });
  });
};
