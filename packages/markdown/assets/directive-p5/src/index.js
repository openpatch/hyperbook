/// <reference path="../../hyperbook.types.js" />

import { buildSketchPage, decodeWorkspace } from "./page.js";
import { setupComparison } from "./compare.js";
import { p5Completions } from "./completions.js";

/**
 * p5.js creative coding environment.
 * @type {HyperbookP5}
 * @memberof hyperbook
 */
hyperbook.p5 = (function () {
  function initElement(elem) {
    if (elem.getAttribute("data-p5-initialized") === "true") return;
    elem.setAttribute("data-p5-initialized", "true");

    const frame = elem.querySelector("iframe");
    const template = elem.getAttribute("data-template") || "";
    const editor = elem.querySelector(".editor");

    if (!editor) {
      const { main, files } = decodeWorkspace(
        elem.getAttribute("data-workspace"),
      );
      frame.srcdoc = buildSketchPage(template, files, main);
      return;
    }

    const ide = HyperbookIDE.mount(elem, {
      id: elem.getAttribute("data-id"),
      runtime: "p5",
      editor,
      workspace: elem.getAttribute("data-workspace"),
      lang: (path) => (/\.m?js$/.test(path) ? "javascript" : ""),
      editorOptions: { completions: [p5Completions] },
      buttons: {
        reset: elem.querySelector("button.reset"),
        copy: elem.querySelector("button.copy"),
        download: elem.querySelector("button.download"),
        fullscreen: elem.querySelector("button.fullscreen"),
      },
      layout: {
        container: elem.querySelector(".container"),
        editorContainer: elem.querySelector(".editor-container"),
        splitter: elem.querySelector(".splitter"),
      },
    });

    const update = () => {
      frame.srcdoc = buildSketchPage(template, ide.files(), ide.main);
    };

    const comparison = elem.hasAttribute("data-compare")
      ? setupComparison(elem, ide, template)
      : null;
    elem.querySelector("button.update")?.addEventListener("click", () => {
      update();
      void comparison?.changed();
    });
    ide.ready.then(() => {
      update();
      // What the reader saved is scored, but the target stays in front.
      void comparison?.changed({ reveal: false });
    });
  }

  function init(root) {
    root.querySelectorAll(".directive-p5").forEach(initElement);
  }

  document.addEventListener("DOMContentLoaded", () => init(document));

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1 && node.classList.contains("directive-p5")) {
          initElement(node);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return { init };
})();
