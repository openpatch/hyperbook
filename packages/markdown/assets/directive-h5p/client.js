/// <reference path="../hyperbook.types.js" />

/**
 * H5P interactive content integration.
 * @type {HyperbookH5p}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.h5p = (function () {
  /**
   * Initialize H5P elements within the given root element.
   * @param {HTMLElement} [root=document] - The root element to initialize.
   */

  const save = (id) =>
    H5P.getUserData(id, "state", (error, userData) => {
      if (!error) {
        hyperbook.store.h5p.put({ id, userData });
      }
    });

  const init = async (root) => {
    const els = root.getElementsByClassName("directive-h5p");
    const assets = `${HYPERBOOK_ASSETS}directive-h5p`;

    const h5pBaseOptions = {
      frameJs: `${assets}/frame.bundle.js`,
      frameCss: `${assets}/styles/h5p.css`,
      librariesPath: `${assets}/libraries`,
      saveFreq: 1,
      contentUserData: undefined,
      frame: false,
      copyright: false,
      export: false,
      icon: false,
      embed: false,
    };

    for (const el of els) {
      const h5pFrame = el.querySelector(".h5p-frame");
      const src = el.getAttribute("data-src");
      const id = el.getAttribute("data-id");
      if (h5pFrame && src) {
        const result = await hyperbook.store.h5p.get(id);
        const h5pOptions = {
          ...h5pBaseOptions,
          id,
          h5pJsonPath: src,
          contentUserData: result
            ? [{ state: JSON.stringify(result.userData) }]
            : undefined,
        };

        new H5PStandalone.H5P(h5pFrame, h5pOptions);

        // save from time to time
        setInterval(() => save(id), 1000);
      }
    }
  };

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
          node.classList.contains("directive-h5p")
        ) {
          init(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return { init, save };
})();
