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

  function initElement(elem) {
    const editor = elem.getElementsByClassName("editor")[0];
    /** @type {HTMLButtonElement} */
    const update = elem.getElementsByClassName("update")[0];
    const frame = elem.getElementsByTagName("iframe")[0];
    const template = elem.getAttribute("data-template");
    const id = elem.getAttribute("data-id");
    const copyEl = elem.getElementsByClassName("copy")[0];
    const resetEl = elem.getElementsByClassName("reset")[0];
    const downloadEl = elem.getElementsByClassName("download")[0];

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
      hyperbook.store.p5.delete(id);
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
        const result = await hyperbook.store.p5.get(id);
        if (result) {
          editor.value = result.sketch;
          const code = result.sketch;
          frame.srcdoc = template
            .replace("###SLOT###", wrapSketch(code))
            .replaceAll("###ORIGIN###", window.location.origin)
            .replace(/\u00A0/g, " ");
        }

        editor.addEventListener("input", () => {
          hyperbook.store.p5.put({ id, sketch: editor.value });
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
