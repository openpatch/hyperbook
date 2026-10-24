import {
  runtimes,
  interruptBuffers,
  getExecutionState,
  turtleModules,
} from "./state.js";
import { abortStdin } from "./stdin.js";
import { appendOutputLine } from "./output.js";
import { cancelPythonTasks } from "./execution.js";

export const releaseKeyboardCapture = (id) => {
  // A turtle program that reacts to keys keeps them after it has returned.
  if (turtleModules.get(id)?.__hasKeyBindings()) return;
  const elem = document.getElementById(id);
  if (!elem) return;
  const canvas = elem.getElementsByClassName("canvas")[0];
  canvas?.blur?.();
};

export const getRunningInstanceId = () => {
  const elems = document.getElementsByClassName("directive-pyide");
  for (const elem of elems) {
    if (getExecutionState(elem.id).running) {
      return elem.id;
    }
  }
  return null;
};

export const updateRunning = () => {
  const runningInstanceId = getRunningInstanceId();
  const elems = document.getElementsByClassName("directive-pyide");
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

    stop?.removeEventListener("click", handleStopClick);
    run.classList.remove("stopping");
    run.classList.remove("locked");
    test?.classList.remove("stopping");
    test?.classList.remove("locked");
    stop?.classList.remove("stopping");
    elem.classList.toggle("locked-by-other", lockedByOther);

    if (state.running || lockedByOther) {
      editor?.classList.add("running");
      editorCm?.setReadOnly(true);
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
            lockedByOther
              ? "pyide-locked-other-instance-running"
              : "pyide-test",
          );
          test.classList.toggle("locked", lockedByOther);
          test.classList.add("running");
          test.disabled = true;
        }
      }

      if (stop) {
        if (state.running) {
          stop.textContent = state.stopping
            ? hyperbook.i18n.get("pyide-stopping")
            : hyperbook.i18n.get("pyide-stop");
          stop.disabled = false;
          stop.addEventListener("click", handleStopClick);
        } else {
          stop.textContent = hyperbook.i18n.get("pyide-stop");
          stop.disabled = true;
        }
        stop.classList.toggle("stopping", state.stopping);
      }
    } else {
      editor?.classList.remove("running");
      editorCm?.setReadOnly(false);
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
        stop.textContent = hyperbook.i18n.get("pyide-stop");
        stop.disabled = true;
      }
    }
  }
};

const RETURN_KEY = "hyperbook-pyide-return";

/** The element that scrolls the page around `elem`. */
const scrollerOf = (elem) => {
  for (let node = elem.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (
      /auto|scroll/.test(overflowY) &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
  }
  return document.scrollingElement || document.documentElement;
};

const currentPage = () => window.location.pathname + window.location.search;

/**
 * Last resort for a script that does not stop: reload the page, noting where
 * the IDE was on the screen, so the learner finds it there again.
 */
const reloadAndReturn = (id) => {
  const elem = document.getElementById(id);
  try {
    window.sessionStorage.setItem(
      RETURN_KEY,
      JSON.stringify({
        page: currentPage(),
        id,
        top: elem ? elem.getBoundingClientRect().top : null,
      }),
    );
  } catch {}
  window.location.reload();
};

/**
 * After reloadAndReturn(): put the IDE back where it was on the screen.
 * @returns whether the page was reloaded to stop this IDE's script
 */
export const returnAfterReload = (elem) => {
  let saved = null;
  try {
    saved = JSON.parse(window.sessionStorage.getItem(RETURN_KEY) || "null");
  } catch {}
  if (!saved || saved.id !== elem.id || saved.page !== currentPage()) {
    return false;
  }
  try {
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch {}
  const scrollBack = () => {
    if (typeof saved.top !== "number") return;
    scrollerOf(elem).scrollTop += elem.getBoundingClientRect().top - saved.top;
  };
  requestAnimationFrame(scrollBack);
  // Images and other elements above the IDE may still change their height.
  if (document.readyState !== "complete") {
    window.addEventListener("load", () => requestAnimationFrame(scrollBack), {
      once: true,
    });
  }
  return true;
};

export const requestStop = (id) => {
  const state = getExecutionState(id);
  const hasRuntime = runtimes.has(id);
  if ((!state.running && !hasRuntime) || state.stopRequested) return;
  state.stopRequested = true;
  state.stopping = true;
  // A script waiting for a timer, the next frame of a game loop or
  // time.sleep() ends there once its asyncio tasks are cancelled.
  if (!state.finishing) cancelPythonTasks(id);
  // A script waiting for input() or for the turtle ends there with an error.
  // This also halts the turtle's animation, event handlers and timers.
  abortStdin(id);
  turtleModules.get(id)?.__stop();
  releaseKeyboardCapture(id);
  updateRunning();
  // Python has already returned; only the drawing was still going.
  if (state.finishing) return;

  appendOutputLine(id, "Stop requested. Interrupting execution...");
  // Should the script still run, interrupt it, and as a last resort reload
  // the page -- but not while packages are loading, which ends by itself.
  const stillExecuting = () =>
    state.running && state.stopRequested && state.executing;
  window.setTimeout(() => {
    if (!stillExecuting()) return;
    const interruptBuffer = interruptBuffers.get(id);
    if (interruptBuffer) interruptBuffer[0] = 2;
    window.setTimeout(() => {
      if (!stillExecuting()) return;
      appendOutputLine(id, hyperbook.i18n.get("pyide-stop-reloading"));
      window.setTimeout(() => reloadAndReturn(id), 500);
    }, 3000);
  }, 1000);
};

export const handleStopClick = (event) => {
  const elem = event.currentTarget.closest(".directive-pyide");
  if (!elem?.id) return;
  requestStop(elem.id);
};

