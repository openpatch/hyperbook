hyperbook.learningmap = (function () {
  async function init(root) {
    const elems = root.getElementsByClassName("directive-learningmap");

    for (let elem of elems) {
      const map = elem.getElementsByTagName("hyperbook-learningmap")[0];
      if (map) {
        const result = await store.learningmap.get(elem.id);
        if (result && result.nodeState) {
          map.nodeState = result.nodeState;
          map.x = result.x || 0;
          map.y = result.y || 0;
          map.zoom = result.zoom || 1;
        }
        map.addEventListener("change", function (event) {
          store.learningmap
            .update(elem.id, {
              nodeState: event.detail,
            })
            .then((updated) => {
              if (updated == 0) {
                store.learningmap.put({
                  id: elem.id,
                  nodeState: event.detail,
                });
              }
            });
        });
        map.addEventListener("viewport-change", function (event) {
          store.learningmap
            .update(elem.id, {
              x: event.detail.x,
              y: event.detail.y,
              zoom: event.detail.zoom,
            })
            .then((updated) => {
              if (updated == 0) {
                store.learningmap.put({
                  id: elem.id,
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
