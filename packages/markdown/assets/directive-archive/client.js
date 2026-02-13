/// <reference path="../hyperbook.types.js" />

/**
 * Archive download management.
 * @type {HyperbookArchive}
 * @memberof hyperbook
 * @see hyperbook.i18n
 */
hyperbook.archive = (function () {
  function initElement(el) {
    const labelEl = el.getElementsByClassName("label")[0];
    const src = el.href;

    fetch(src).then((r) => {
      const isOnline = r.ok;
      if (isOnline) {
        labelEl.classList.remove("offline");
        labelEl.innerHTML = labelEl.innerHTML.replace(`(${hyperbook.i18n.get("archive-offline")})`, "");
      } else {
        labelEl.classList.add("offline");
        labelEl.innerHTML += ` (${hyperbook.i18n.get("archive-offline")})`;
      }
    });
  }

  function init() {
    const els = document.getElementsByClassName("directive-archive");
    for (let el of els) {
      initElement(el);
    }
  }

  const observer = new MutationObserver((mutations) => {
    for (let mutation of mutations) {
      if (mutation.type === "childList") {
        for (let node of mutation.addedNodes) {
          if (node.classList && node.classList.contains("directive-archive")) {
            initElement(node);
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init();
  });

  return { init };
})();
