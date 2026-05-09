/// <reference path="../hyperbook.types.js" />

/**
 * p5.js creative coding environment.
 * @type {HyperbookP5}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.p5 = (function () {
  window.codeInput?.registerTemplate(
    "p5-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.AutoCloseBrackets(),
      new codeInput.plugins.Indent(true, 2),
    ]),
  );

  const wrapSketch = (sketchCode) => {
    if (sketchCode !== "" && !sketchCode?.includes("setup")) {
      return `
      function setup() {
        createCanvas(100, 100);
        background(200);
        ${sketchCode}
      }`;
    }
    return sketchCode;
  };

  function setupSplitter(elem, container, editorContainer, splitter) {
    if (!container || !editorContainer || !splitter) return;

    const minPanelSize = 120;

    const getIsHorizontal = () =>
      getComputedStyle(elem).flexDirection.startsWith("row");

    const applySplitSize = (rawSize, isHorizontal) => {
      const total = isHorizontal ? elem.clientWidth : elem.clientHeight;
      const splitterSize = isHorizontal ? splitter.offsetWidth : splitter.offsetHeight;
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
  }

  function initElement(elem) {
    if (elem.getAttribute("data-p5-initialized") === "true") return;
    elem.setAttribute("data-p5-initialized", "true");

    const container = elem.querySelector(".container");
    const editorContainer = elem.querySelector(".editor-container");
    const splitter = elem.querySelector(".splitter");
    const editor = elem.getElementsByClassName("editor")[0];
    /** @type {HTMLButtonElement} */
    const update = elem.getElementsByClassName("update")[0];
    const frame = elem.getElementsByTagName("iframe")[0];
    const template = elem.getAttribute("data-template");
    const id = elem.getAttribute("data-id");
    const copyEl = elem.getElementsByClassName("copy")[0];
    const resetEl = elem.getElementsByClassName("reset")[0];
    const downloadEl = elem.getElementsByClassName("download")[0];

    setupSplitter(elem, container, editorContainer, splitter);

    if (frame) {
      frame.srcdoc = frame.srcdoc.replaceAll(
        "###ORIGIN###",
        window.location.origin,
      );
    }

    copyEl?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(editor.value);
      } catch (error) {
        console.error(error.message);
      }
    });

    resetEl?.addEventListener("click", () => {
      hyperbook.store.db.p5.delete(id);
      window.location.reload();
    });

    downloadEl?.addEventListener("click", () => {
      const a = document.createElement("a");
      const blob = new Blob([editor.value], { type: "text/plain" });
      a.href = URL.createObjectURL(blob);
      a.download = `sketch-${id}.js`;
      a.click();
    });

    editor?.addEventListener("code-input_load", async () => {
      if (id) {
        const result = await hyperbook.store.db.p5.get(id);
        if (result) {
          editor.value = result.sketch;
          const code = result.sketch;
          frame.srcdoc = template
            .replace("###SLOT###", wrapSketch(code))
            .replaceAll("###ORIGIN###", window.location.origin)
            .replace(/\u00A0/g, " ");
        }

        editor.addEventListener("input", () => {
          hyperbook.store.db.p5.put({ id, sketch: editor.value });
        });
      }

      update?.addEventListener("click", () => {
        const code = editor.value;
        frame.srcdoc = template
          .replace("###SLOT###", wrapSketch(code))
          .replaceAll("###ORIGIN###", window.location.origin);
      });
    });
  }

  function init(root) {
    const elems = root.querySelectorAll(".directive-p5");
    elems.forEach(initElement);
  }

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === 1 &&
          node.classList.contains("directive-p5")
        ) {
          initElement(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return { init };
})();
