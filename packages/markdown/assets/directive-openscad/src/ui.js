import { i18nGet } from "./utils.js";

export function setupCanvasParamsSplitter(
  leftSide,
  previewContainer,
  paramsPanel,
  splitter,
  onSplitChanged,
) {
  if (!leftSide || !previewContainer || !paramsPanel || !splitter) return;

  const minSize = 80;

  const applySplitSize = (rawSize) => {
    const total = leftSide.clientHeight;
    const splitterSize = splitter.offsetHeight;
    const maxSize = Math.max(minSize, total - splitterSize - minSize);
    const clamped = Math.max(minSize, Math.min(rawSize, maxSize));
    previewContainer.style.flex = `0 0 ${clamped}px`;
    return clamped;
  };

  const applyStoredSplitSize = () => {
    const rawStored = Number(leftSide.dataset.splitCanvasParams);
    if (!Number.isFinite(rawStored) || rawStored <= 0) {
      previewContainer.style.flex = "";
      return;
    }
    applySplitSize(rawStored);
  };

  applyStoredSplitSize();

  splitter.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    splitter.setPointerCapture(event.pointerId);

    const startPointer = event.clientY;
    const startSize = previewContainer.getBoundingClientRect().height;

    const onPointerMove = (moveEvent) => {
      const delta = moveEvent.clientY - startPointer;
      const size = applySplitSize(startSize + delta);
      leftSide.dataset.splitCanvasParams = String(Math.round(size));
      onSplitChanged?.({ splitCanvasParams: Math.round(size) });
    };

    const onPointerUp = () => {
      splitter.removeEventListener("pointermove", onPointerMove);
      splitter.removeEventListener("pointerup", onPointerUp);
      splitter.removeEventListener("pointercancel", onPointerUp);
      const splitCanvasParams = Number(leftSide.dataset.splitCanvasParams);
      if (Number.isFinite(splitCanvasParams) && splitCanvasParams > 0) {
        onSplitChanged?.({
          splitCanvasParams: Math.round(splitCanvasParams),
        });
      }
    };

    splitter.addEventListener("pointermove", onPointerMove);
    splitter.addEventListener("pointerup", onPointerUp);
    splitter.addEventListener("pointercancel", onPointerUp);
  });

  window.addEventListener("resize", applyStoredSplitSize);
  return applyStoredSplitSize;
}

export function setupSplitter(
  elem,
  leftSide,
  editorContainer,
  splitter,
  onSplitChanged,
) {
  if (!leftSide || !editorContainer || !splitter) return;

  const previewContainer = leftSide;

  const minPanelSize = 120;

  const getIsHorizontal = () =>
    getComputedStyle(elem).flexDirection.startsWith("row");

  const applySplitSize = (rawSize, isHorizontal) => {
    const total = isHorizontal ? elem.clientWidth : elem.clientHeight;
    const splitterSize = isHorizontal
      ? splitter.offsetWidth
      : splitter.offsetHeight;
    const maxSize = Math.max(
      minPanelSize,
      total - splitterSize - minPanelSize,
    );
    const clamped = Math.max(minPanelSize, Math.min(rawSize, maxSize));
    previewContainer.style.flex = `0 0 ${clamped}px`;
    return clamped;
  };

  const applyStoredSplitSize = () => {
    const isHorizontal = getIsHorizontal();
    elem.classList.toggle("split-horizontal", isHorizontal);
    elem.classList.toggle("split-vertical", !isHorizontal);
    const key = isHorizontal ? "splitHorizontal" : "splitVertical";
    const rawStored = Number(elem.dataset[key]);
    if (!Number.isFinite(rawStored) || rawStored <= 0) {
      previewContainer.style.flex = "";
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
      ? previewContainer.getBoundingClientRect().width
      : previewContainer.getBoundingClientRect().height;

    elem.classList.add("resizing");

    const onPointerMove = (moveEvent) => {
      const pointer = isHorizontal ? moveEvent.clientX : moveEvent.clientY;
      const delta = pointer - startPointer;
      const size = applySplitSize(startSize + delta, isHorizontal);
      elem.dataset[key] = String(Math.round(size));
      onSplitChanged?.({
        [key]: Math.round(size),
      });
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
}

export const updateFullscreenButtonState = (elem, button) => {
  if (!elem || !button) return;
  const isFullscreen = document.fullscreenElement === elem;
  const label = i18nGet("ide-fullscreen-enter", "Fullscreen");
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
  const elems = document.querySelectorAll(".directive-openscad");
  elems.forEach((elem) => {
    const fullscreen = elem.querySelector("button.fullscreen");
    updateFullscreenButtonState(elem, fullscreen);
  });
};
