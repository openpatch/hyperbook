hyperbook.geogebra = (function () {
  async function init(root) {
    const els = root.getElementsByTagName("hyperbook-geogebra");
    for (const el of els) {
      const id = el.getAttribute("data-id");

      const result = await store.geogebra.get(id);
      if (result && result.state) {
        el.setBase64(result.state);
      }

      el.registerUpdateListener(() => {
        el.getBase64((b) => {
          store.geogebra.put({ id, state: b });
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

  init(document);
})();
