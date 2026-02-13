/// <reference path="../hyperbook.types.js" />

/**
 * Learning map visualization and progress tracking.
 * @type {HyperbookLearningmap}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.learningmap = (function () {
  async function init(root) {
    const elems = root.getElementsByClassName("directive-learningmap");

    for (let elem of elems) {
      const map = elem.getElementsByTagName("hyperbook-learningmap")[0];
      if (map) {
        const result = await hyperbook.store.learningmap.get(elem.id);
        if (result) {
          map.initialState = result;
        }
        map.addEventListener("change", function (event) {
          hyperbook.store.learningmap
            .update(elem.id, {
              id: elem.id,
              nodes: event.detail.nodes,
              x: event.detail.x,
              y: event.detail.y,
              zoom: event.detail.zoom,
            })
            .then((updated) => {
              if (updated == 0) {
                hyperbook.store.learningmap.put({
                  id: elem.id,
                  nodes: event.detail.nodes,
                  x: event.detail.x,
                  y: event.detail.y,
                  zoom: event.detail.zoom,
                });
              }
            });
        });
      }
    }
  }

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // Element node
          init(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return {
    init,
  };
})();
