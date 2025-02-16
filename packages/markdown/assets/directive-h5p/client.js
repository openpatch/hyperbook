hyperbook.h5p = (function () {
  /**
   * Initialize H5P elements within the given root element.
   * @param {HTMLElement} [root=document] - The root element to initialize.
   */

  const save = (id) =>
    H5P.getUserData(id, "state", (error, userData) => {
      if (!error) {
        store.h5p.put({ id, userData });
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
        const result = await store.h5p.get(id);
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

  init(document);
})();
