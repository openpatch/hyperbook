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
