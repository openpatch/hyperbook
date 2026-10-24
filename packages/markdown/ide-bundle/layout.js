/**
 * Layout pieces every IDE has: the splitter between output and editor, and
 * the fullscreen toggle.
 */

/**
 * Makes the splitter between an IDE's output `container` and its
 * `editorContainer` draggable. The sizes live in `elem.dataset`
 * (splitHorizontal / splitVertical), so a restored row can set them before
 * the returned function applies them.
 *
 * @param {HTMLElement} elem The IDE root; its flex-direction picks the axis.
 * @param {HTMLElement} container
 * @param {HTMLElement} editorContainer
 * @param {HTMLElement} splitter
 * @param {(sizes: {splitHorizontal?: number, splitVertical?: number}) => void} [onSplitChanged]
 * @returns {(() => void) | undefined} Re-applies the stored size.
 */
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
    const splitterSize = isHorizontal
      ? splitter.offsetWidth
      : splitter.offsetHeight;
    const maxSize = Math.max(minPanelSize, total - splitterSize - minPanelSize);
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

/** IDE roots with a fullscreen button, kept in sync on fullscreenchange. */
const fullscreenTargets = new Map();

/**
 * @param {HTMLElement} elem
 * @param {HTMLElement | null | undefined} button
 */
export const updateFullscreenButtonState = (elem, button) => {
  if (!elem || !button) return;
  const isFullscreen = document.fullscreenElement === elem;
  const label = hyperbook.i18n.get("ide-fullscreen-enter");
  button.title = label;
  button.setAttribute("aria-label", label);
  button.classList.toggle("active", isFullscreen);
};

/** @param {HTMLElement} elem */
export const toggleFullscreen = async (elem) => {
  if (!elem) return;
  if (document.fullscreenElement === elem) {
    await document.exitFullscreen();
    return;
  }
  await elem.requestFullscreen();
};

/**
 * Wires a fullscreen button to toggle `elem`.
 * @param {HTMLElement} elem
 * @param {HTMLElement | null | undefined} button
 */
export const setupFullscreen = (elem, button) => {
  if (!button) return;
  button.addEventListener("click", async () => {
    try {
      await toggleFullscreen(elem);
    } catch (error) {
      console.error(error.message);
    }
  });
  fullscreenTargets.set(elem, button);
  updateFullscreenButtonState(elem, button);
};

document.addEventListener("fullscreenchange", () => {
  for (const [elem, button] of fullscreenTargets) {
    updateFullscreenButtonState(elem, button);
  }
});
