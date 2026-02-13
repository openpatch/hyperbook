/// <reference path="../hyperbook.types.js" />

/**
 * GeoGebra math applet integration.
 * @type {HyperbookGeogebra}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.geogebra = (function () {
  async function init(root) {
    const els = root.getElementsByTagName("hyperbook-geogebra");
    for (const el of els) {
      const id = el.getAttribute("data-id");

      const result = await hyperbook.store.geogebra.get(id);
      if (result && result.state) {
        el.setBase64(result.state);
      }

      el.registerUpdateListener(() => {
        el.getBase64((b) => {
          hyperbook.store.geogebra.put({ id, state: b });
        });
      });
    }
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === 1 &&
          node.classList.contains("directive-geogebra")
        ) {
          // Element node
          init(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });

  return { init };
})();
