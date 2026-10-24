/// <reference path="../../hyperbook.types.js" />

import { buildPage } from "./page.js";
import { setupComparison } from "./compare.js";

/**
 * Web IDE: a small website whose files are edited in tabs and shown live.
 * @type {HyperbookWebide}
 * @memberof hyperbook
 */
hyperbook.webide = (function () {
  const UPDATE_DELAY = 300;
  // Scoring renders both pages: once the reader pauses.
  const SCORE_DELAY = 1000;

  function initElement(elem) {
    if (elem.getAttribute("data-webide-initialized") === "true") return;
    elem.setAttribute("data-webide-initialized", "true");

    const id = elem.getAttribute("data-id");
    const frame = elem.querySelector("iframe");
    const title = elem.querySelector(".container-title");

    let shownUrls = [];
    let timer = 0;
    let scoreTimer = 0;
    /** Set below, once the IDE is mounted. */
    let comparison = null;

    const ide = HyperbookIDE.mount(elem, {
      id,
      runtime: "webide",
      editor: elem.querySelector(".editor"),
      workspace: elem.getAttribute("data-workspace"),
      lang: (path) => {
        if (path.endsWith(".html")) return "html";
        if (path.endsWith(".css")) return "css";
        if (/\.m?js$/.test(path)) return "javascript";
        return "";
      },
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
      onChange: () => {
        clearTimeout(timer);
        timer = setTimeout(update, UPDATE_DELAY);
        if (comparison) {
          clearTimeout(scoreTimer);
          scoreTimer = setTimeout(() => void comparison.changed(), SCORE_DELAY);
        }
      },
    });

    const update = () => {
      const previous = shownUrls;
      const { html, urls } = buildPage(ide.files(), ide.main, (blob) =>
        URL.createObjectURL(blob),
      );
      shownUrls = urls;
      frame.srcdoc = html;
      // The old document may still be loading its files.
      frame.addEventListener(
        "load",
        () => previous.forEach((url) => URL.revokeObjectURL(url)),
        { once: true },
      );
    };

    const titleText = title.querySelector(".container-title-text") || title;
    frame.addEventListener("load", () => {
      titleText.textContent = frame.contentDocument?.title ?? "";
    });

    if (elem.hasAttribute("data-compare")) comparison = setupComparison(elem, ide);
    ide.ready.then(() => {
      update();
      // What the reader saved is scored, but the target stays in front.
      void comparison?.changed({ reveal: false });
    });
  }

  function init(root) {
    root.querySelectorAll(".directive-webide").forEach(initElement);
  }

  document.addEventListener("DOMContentLoaded", () => init(document));

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1 && node.classList.contains("directive-webide")) {
          initElement(node);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return { init };
})();
