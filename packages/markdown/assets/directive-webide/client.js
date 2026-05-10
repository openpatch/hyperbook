/// <reference path="../hyperbook.types.js" />

/**
 * Web IDE with HTML/CSS/JS editing.
 * @type {HyperbookWebide}
 * @memberof hyperbook
 * @see hyperbook.store
 * @see hyperbook.i18n
 */
hyperbook.webide = (function () {
  window.codeInput?.registerTemplate(
    "webide-highlighted",
    codeInput.templates.prism(window.Prism, [
      new codeInput.plugins.AutoCloseBrackets(),
      new codeInput.plugins.Indent(true, 2),
    ]),
  );

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
      };

      splitter.addEventListener("pointermove", onPointerMove);
      splitter.addEventListener("pointerup", onPointerUp);
      splitter.addEventListener("pointercancel", onPointerUp);
    });

    window.addEventListener("resize", applyStoredSplitSize);
  }

  const updateFullscreenButtonState = (elem, button) => {
    if (!elem || !button) return;
    const isFullscreen = document.fullscreenElement === elem;
    const label = hyperbook.i18n.get("ide-fullscreen-enter");
    button.textContent = "⛶";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.classList.toggle("active", isFullscreen);
  };

  const toggleFullscreen = async (elem) => {
    if (!elem) return;
    if (document.fullscreenElement === elem) {
      await document.exitFullscreen();
      return;
    }
    await elem.requestFullscreen();
  };

  const syncFullscreenButtons = () => {
    const elems = document.querySelectorAll(".directive-webide");
    elems.forEach((elem) => {
      const fullscreen = elem.querySelector("button.fullscreen");
      updateFullscreenButtonState(elem, fullscreen);
    });
  };

  function initElement(elem) {
    if (elem.getAttribute("data-webide-initialized") === "true") return;
    elem.setAttribute("data-webide-initialized", "true");

    const container = elem.querySelector(".container");
    const editorContainer = elem.querySelector(".editor-container");
    const splitter = elem.querySelector(".splitter");
    const title = elem.getElementsByClassName("container-title")[0];
    /** @type {HTMLTextAreaElement | null} */
    const editorHTML = elem.querySelector(".editor.html");
    /** @type {HTMLTextAreaElement | null} */
    const editorCSS = elem.querySelector(".editor.css");
    /** @type {HTMLTextAreaElement | null} */
    const editorJS = elem.querySelector(".editor.js");
    /** @type {HTMLButtonElement | null} */
    const btnHTML = elem.querySelector("button.html");
    /** @type {HTMLButtonElement | null} */
    const btnCSS = elem.querySelector("button.css");
    /** @type {HTMLButtonElement | null} */
    const btnJS = elem.querySelector("button.js");

    const frame = elem.getElementsByTagName("iframe")[0];
    const template = elem.getAttribute("data-template");
    const id = elem.getAttribute("data-id");
    /** @type {HTMLButtonElement} */
    const resetEl = elem.querySelector("button.reset");
    /** @type {HTMLButtonElement} */
    const downloadEl = elem.querySelector("button.download");
    /** @type {HTMLButtonElement} */
    const fullscreenEl = elem.querySelector("button.fullscreen");

    setupSplitter(elem, container, editorContainer, splitter);

    fullscreenEl?.addEventListener("click", async () => {
      try {
        await toggleFullscreen(elem);
      } catch (error) {
        console.error(error.message);
      }
    });
    updateFullscreenButtonState(elem, fullscreenEl);

    resetEl?.addEventListener("click", () => {
      if (window.confirm(hyperbook.i18n.get("webide-reset-prompt"))) {
        hyperbook.store.db.webide.delete(id);
        window.location.reload();
      }
    });

    btnHTML?.addEventListener("click", () => {
      btnHTML?.classList.add("active");
      btnCSS?.classList.remove("active");
      btnJS?.classList.remove("active");

      editorHTML?.classList.add("active");
      editorCSS?.classList.remove("active");
      editorJS?.classList.remove("active");
    });

    btnCSS?.addEventListener("click", () => {
      btnHTML?.classList.remove("active");
      btnCSS?.classList.add("active");
      btnJS?.classList.remove("active");

      editorHTML?.classList.remove("active");
      editorCSS?.classList.add("active");
      editorJS?.classList.remove("active");
    });

    btnJS?.addEventListener("click", () => {
      btnHTML?.classList.remove("active");
      btnCSS?.classList.remove("active");
      btnJS?.classList.add("active");

      editorHTML?.classList.remove("active");
      editorCSS?.classList.remove("active");
      editorJS?.classList.add("active");
    });

    const load = async () => {
      const result = await hyperbook.store.db.webide.get(id);
      if (!result) {
        return;
      }
      const website = template
        .replace("###HTML###", result.html)
        .replace("###CSS###", result.css)
        .replace("###JS###", result.js);
      frame.srcdoc = website;
    };

    load();

    const update = () => {
      hyperbook.store.db.webide.put({
        id,
        html: editorHTML?.value,
        css: editorCSS?.value,
        js: editorJS?.value,
      });
      const website = template
        .replace("###HTML###", editorHTML?.value)
        .replace("###CSS###", editorCSS?.value)
        .replace("###JS###", editorJS?.value);
      frame.srcdoc = website;
    };

    frame.addEventListener("load", () => {
      title.textContent = frame.contentDocument.title;
    });

    editorHTML?.addEventListener("code-input_load", async () => {
      const result = await hyperbook.store.db.webide.get(id);
      if (result) {
        editorHTML.value = result.html;
      }

      update();

      editorHTML.addEventListener("input", () => {
        update();
      });
    });

    editorCSS?.addEventListener("code-input_load", async () => {
      const result = await hyperbook.store.db.webide.get(id);
      if (result) {
        editorCSS.value = result.css;
      }

      update();

      editorCSS.addEventListener("input", () => {
        update();
      });
    });

    editorJS?.addEventListener("code-input_load", async () => {
      const result = await hyperbook.store.db.webide.get(id);
      if (result) {
        editorJS.value = result.js;
      }

      update();

      editorJS.addEventListener("input", () => {
        update();
      });
    });

    downloadEl?.addEventListener("click", async () => {
      const a = document.createElement("a");
      const website = frame.srcdoc;
      const blob = new Blob([website], { type: "text/html" });
      a.href = URL.createObjectURL(blob);
      a.download = `website-${id}.html`;
      a.click();
    });
  }

  function init(root) {
    const elems = root.querySelectorAll(".directive-webide");
    elems.forEach(initElement);
  }

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });
  document.addEventListener("fullscreenchange", syncFullscreenButtons);

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === 1 &&
          node.classList.contains("directive-webide")
        ) {
          initElement(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return { init };
})();
