/// <reference path="../hyperbook.types.js" />

/**
 * Mermaid diagram rendering.
 * @type {HyperbookMermaid}
 * @memberof hyperbook
 */
hyperbook.mermaid = (function () {
  const elementCode = ".directive-mermaid";

  const loadMermaid = async function (theme) {
    window.mermaid.initialize({ theme, startOnLoad: false });
    let i = 0;
    for (const el of document.querySelectorAll(elementCode)) {
      // skip this one, not every diagram after it
      if (el.getAttribute("data-processed")) continue;

      el.setAttribute("data-processed", true);
      let id = `graph-` + Date.now() + i++;

      mermaid.render(id, el.innerText).then(({ svg }) => {
        el.innerHTML = svg;
      });
    }
  };

  const resetProcessed = function () {
    return new Promise((resolve, reject) => {
      try {
        var els = document.querySelectorAll(elementCode),
          count = els.length;
        els.forEach((element) => {
          if (element.getAttribute("data-mermaid") != null) {
            element.removeAttribute("data-processed");
            // remarkDirectiveMermaid encodes the diagram with Buffer.from(),
            // so the attribute holds base64 of its UTF-8 *bytes*. atob() gives
            // those bytes back one per character, which would turn "Ü" into
            // "Ã\u009c" -- decode them as UTF-8 before handing them to mermaid.
            const bytes = Uint8Array.from(
              atob(element.getAttribute("data-mermaid")),
              (c) => c.charCodeAt(0),
            );
            const data = new TextDecoder().decode(bytes);
            const escapedData = data
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#39;");
            element.innerHTML = escapedData;
          }
          count--;
          if (count == 0) {
            resolve();
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  const init = () => {
    const toggle = document.querySelector("dark-mode-toggle");
    if (toggle?.mode == "dark") {
      resetProcessed()
        .then(() => loadMermaid("dark"))
        .catch(console.error);
    } else {
      resetProcessed()
        .then(() => loadMermaid("default"))
        .catch(console.error);
    }

    document.addEventListener("colorschemechange", (e) => {
      if (e.detail.colorScheme === "dark") {
        resetProcessed()
          .then(() => loadMermaid("dark"))
          .catch(console.error);
      } else {
        resetProcessed()
          .then(() => loadMermaid("default"))
          .catch(console.error);
      }
    });
  };

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init();
  });

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.hasAttribute("data-mermaid")) {
          // Element node
          const toggle = document.querySelector("dark-mode-toggle");
          if (toggle?.mode == "dark") {
            resetProcessed()
              .then(() => loadMermaid("dark"))
              .catch(console.error);
          } else {
            resetProcessed()
              .then(() => loadMermaid("default"))
              .catch(console.error);
          }
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return {
    init,
  };
})();
