import { getExecutionState } from "./state.js";
import { killWorker } from "./cheerpj.js";
import { finishRun } from "./execution.js";
import { appendOutputLine } from "./output.js";

export const getRunningInstanceId = () => {
  const elems = document.getElementsByClassName("directive-javaide");
  for (const elem of elems) {
    if (getExecutionState(elem.id).running) {
      return elem.id;
    }
  }
  return null;
};

export const updateRunning = () => {
  const runningInstanceId = getRunningInstanceId();
  const elems = document.getElementsByClassName("directive-javaide");
  for (let elem of elems) {
    const run = elem.getElementsByClassName("run")[0];
    const test = elem.getElementsByClassName("test")[0];
    const stop = elem.getElementsByClassName("stop")[0];
    const editor = elem.getElementsByClassName("editor")[0];
    const editorCm = editor?._cm;
    const state = getExecutionState(elem.id);
    const lockedByOther =
      runningInstanceId !== null &&
      runningInstanceId !== elem.id &&
      !state.running;

    run.classList.remove("stopping", "locked");
    test?.classList.remove("stopping", "locked");
    stop?.classList.remove("stopping");
    elem.classList.toggle("locked-by-other", lockedByOther);

    if (state.running || lockedByOther) {
      editor?.classList.add("running");
      editorCm?.setReadOnly(true);
      if (state.running && state.type === "run") {
        run.textContent = hyperbook.i18n.get("javaide-running");
        run.disabled = true;
        run.classList.add("running");
        if (test) {
          test.classList.add("running");
          test.disabled = true;
        }
      } else if (state.running && state.type === "test" && test) {
        test.textContent = hyperbook.i18n.get("javaide-testing");
        test.disabled = true;
        test.classList.add("running");
        run.classList.add("running");
        run.disabled = true;
      } else {
        const lockLabel = lockedByOther
          ? "javaide-locked-other-instance-running"
          : "javaide-run";
        run.textContent = hyperbook.i18n.get(lockLabel);
        run.classList.add("running");
        run.classList.toggle("locked", lockedByOther);
        run.disabled = true;
        if (test) {
          test.textContent = hyperbook.i18n.get(lockLabel);
          test.classList.toggle("locked", lockedByOther);
          test.classList.add("running");
          test.disabled = true;
        }
      }

      if (stop) {
        if (state.running) {
          stop.textContent = state.stopping
            ? hyperbook.i18n.get("javaide-stopping")
            : hyperbook.i18n.get("javaide-stop");
          stop.disabled = false;
        } else {
          stop.textContent = hyperbook.i18n.get("javaide-stop");
          stop.disabled = true;
        }
        stop.classList.toggle("stopping", state.stopping);
      }
    } else {
      editor?.classList.remove("running");
      editorCm?.setReadOnly(false);
      run.classList.remove("stopping", "running");
      run.textContent = hyperbook.i18n.get("javaide-run");
      run.disabled = false;
      if (test) {
        test.classList.remove("stopping", "running");
        test.textContent = hyperbook.i18n.get("javaide-test");
        test.disabled = false;
      }
      if (stop) {
        stop.classList.remove("stopping", "running");
        stop.textContent = hyperbook.i18n.get("javaide-stop");
        stop.disabled = true;
      }
    }
  }
};

export const requestStop = (id) => {
  const state = getExecutionState(id);
  if (!state.running || state.stopRequested) return;
  state.stopRequested = true;
  state.stopping = true;
  updateRunning();
  // CheerpJ has no interrupt hook: the JVM runs on the worker's own thread,
  // so terminating the worker stops the program outright.
  killWorker();
  appendOutputLine(id, hyperbook.i18n.get("javaide-execution-stopped"));
  finishRun(state, {
    stopped: true,
    compileFailed: false,
    error: null,
    results: [],
  });
};

export const handleStopClick = (event) => {
  const elem = event.currentTarget.closest(".directive-javaide");
  if (elem?.id) requestStop(elem.id);
};
