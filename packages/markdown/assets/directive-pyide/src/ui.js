import { runtimes, interruptBuffers, getExecutionState } from "./state.js";
import { appendOutputLine } from "./output.js";

export const updateFullscreenButtonState = (elem, button) => {
  if (!elem || !button) return;
  const isFullscreen = document.fullscreenElement === elem;
  const label = hyperbook.i18n.get("ide-fullscreen-enter");
  button.textContent = "⛶";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.classList.toggle("active", isFullscreen);
};

export const toggleFullscreen = async (elem) => {
  if (!elem) return;
  if (document.fullscreenElement === elem) {
    await document.exitFullscreen();
    return;
  }
  await elem.requestFullscreen();
};

export const syncFullscreenButtons = () => {
  const elems = document.getElementsByClassName("directive-pyide");
  for (const elem of elems) {
    const fullscreen = elem.getElementsByClassName("fullscreen")[0];
    updateFullscreenButtonState(elem, fullscreen);
  }
};

export const releaseKeyboardCapture = (id) => {
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
        stop.textContent = hyperbook.i18n.get(
          hasInterrupt ? "pyide-stop" : "pyide-stop-refresh",
        );
        stop.disabled = true;
      }
    }
  }
};

export const requestStop = (id) => {
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

export const handleStopClick = (event) => {
  const elem = event.currentTarget.closest(".directive-pyide");
  if (!elem?.id) return;
  requestStop(elem.id);
};

export const setupSplitter = (
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

export const setupCanvasOutputSplitter = (
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
