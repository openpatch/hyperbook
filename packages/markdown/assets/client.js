var hyperbook = (function () {
  /**
   * Initialize elements within the given root element.
   * @param {HTMLElement} root - The root element to initialize.
   */
  const initCollapsibles = (root) => {
    const collapsibleEls = root.getElementsByClassName("collapsible");
    for (let collapsible of collapsibleEls) {
      const id = collapsible.parentElement.getAttribute("data-id");

      if (id.startsWith("_nav:") && !collapsible.classList.contains("empty")) {
        const link = collapsible.querySelector("a");
        link?.addEventListener("click", (event) => {
          event.stopPropagation();
        });
      }
      collapsible.addEventListener("click", () => {
        collapsible.classList.toggle("expanded");
        if (id) {
          store.collapsibles.get(id).then((result) => {
            if (!result) {
              store.collapsibles.put({ id }).then(() => {
                updateCollapsibles(root);
              });
            } else {
              store.collapsibles.delete(id).then(() => {
                updateCollapsibles(root);
              });
            }
          });
        }

        setTimeout(() => {
          window.dispatchEvent(new Event("resize")); // geogebra new this in order resize the applet
        }, 100);
      });
    }
    updateCollapsibles(root);
  };

  /**
   * @param {HTMLElement} root
   */
  const updateCollapsibles = (root) => {
    store.collapsibles.toArray().then((collapsibles) => {
      const collapsibleEls = root.getElementsByClassName("collapsible");
      for (let collapsibleEl of collapsibleEls) {
        const id = collapsibleEl.parentElement.getAttribute("data-id");
        if (id) {
          const expanded = collapsibles.some((c) => c.id === id);
          if (expanded) {
            collapsibleEl.classList.add("expanded");
          } else if (!id.startsWith("_nav:")) {
            collapsibleEl.classList.remove("expanded");
          }
        }
      }
    });
  };

  const initSearch = (root) => {
    const searchInputEl = root.querySelector("#search-input");
    if (searchInputEl) {
      searchInputEl.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          search();
        }
      });
    }
  };

  /**
   * Toggle the table of contents drawer.
   */
  function tocToggle() {
    const tocDrawerEl = document.getElementById("toc-drawer");
    tocDrawerEl.open = !tocDrawerEl.open;
  }

  /**
   * Toggle the search drawer.
   */
  function searchToggle() {
    const searchDrawerEl = document.getElementById("search-drawer");
    searchDrawerEl.open = !searchDrawerEl.open;
  }

  /**
   * Perform a search and display the results.
   */
  function search() {
    const resultsEl = document.getElementById("search-results");
    resultsEl.innerHTML = "";
    const searchInputEl = document.querySelector("#search-input");
    const query = searchInputEl.value;
    const idx = window.lunr.Index.load(LUNR_INDEX);
    const documents = SEARCH_DOCUMENTS;
    const results = idx.search(query);
    for (let result of results) {
      const doc = documents[result.ref];

      const container = document.createElement("a");
      container.href = doc.href;
      container.classList.add("search-result");
      const heading = document.createElement("div");
      heading.textContent = doc.heading;
      heading.classList.add("search-result-heading");
      const content = document.createElement("div");
      content.classList.add("search-result-content");
      const href = document.createElement("div");
      href.classList.add("search-result-href");
      href.textContent = doc.href;

      let contentHTML = "";
      const terms = Object.keys(result.matchData.metadata);
      const term = terms[0];
      if (result?.matchData?.metadata?.[term]?.content?.position?.length > 0) {
        const pos = result.matchData.metadata[term].content.position[0];
        const start = pos[0];
        const len = pos[1];
        let cutoffBefore = start - 50;
        if (cutoffBefore < 0) {
          cutoffBefore = 0;
        } else {
          contentHTML += "...";
        }
        contentHTML += doc.content.slice(cutoffBefore, start);

        contentHTML += `<mark>${doc.content.slice(start, start + len)}</mark>`;
        let cutoffAfter = start + len + 50;

        contentHTML += doc.content.slice(start + len, cutoffAfter);
        if (cutoffAfter < doc.content.length) {
          contentHTML += "...";
        }
      }

      content.innerHTML = contentHTML;

      container.appendChild(heading);
      container.appendChild(content);
      container.appendChild(href);
      resultsEl.appendChild(container);
    }
  }

  /**
   * Open the QR code dialog.
   */
  function qrcodeOpen() {
    const qrCodeDialog = document.getElementById("qrcode-dialog");
    const qrcodeEls = qrCodeDialog.getElementsByClassName("make-qrcode");
    const urlEls = qrCodeDialog.getElementsByClassName("url");
    const qrcodeEl = qrcodeEls[0];
    const qrcode = new window.QRCode({
      content: window.location.href,
      padding: 0,
      join: true,
      color: "var(--color-text)",
      container: "svg-viewbox",
      background: "var(--color-background)",
      ecl: "M",
    });
    qrcodeEl.innerHTML = qrcode.svg();
    for (let urlEl of urlEls[0].children) {
      const href = urlEl.getAttribute("data-href");
      urlEl.innerHTML = `${window.location.origin}${href}`;
    }

    qrCodeDialog.showModal();
  }

  /**
   * Close the QR code dialog.
   */
  function qrcodeClose() {
    const qrCodeDialog = document.getElementById("qrcode-dialog");
    qrCodeDialog.close();
  }

  /**
   * Toggle the navigation drawer.
   */
  function navToggle() {
    const navDrawerEl = document.getElementById("nav-drawer");
    navDrawerEl.open = !navDrawerEl.open;
  }

  /**
   * Toggle a bookmark.
   * @param {string} key - The key of the bookmark.
   * @param {string} label - The label of the bookmark.
   */
  function toggleBookmark(key, label) {
    const el = document.querySelectorAll(`.bookmark[data-key="${key}"]`);
    store.bookmarks.get(key).then((bookmark) => {
      if (!bookmark) {
        store.bookmarks.add({ path: key, label }).then(() => {
          el.forEach((e) => e.classList.add("active"));
          hyperbook.bookmarks.update();
        });
      } else {
        store.bookmarks.delete(key).then(() => {
          el.forEach((e) => e.classList.remove("active"));
          hyperbook.bookmarks.update();
        });
      }
    });
  }

  /**
   * Initialize bookmarks within the given root element.
   * @param {HTMLElement} [root=document] - The root element to initialize.
   */
  function initBookmarks(root = document) {
    const bookmarkEls = root.getElementsByClassName("bookmark");
    for (let bookmarkEl of bookmarkEls) {
      const key = bookmarkEl.getAttribute("data-key");
      store.bookmarks.get(key).then((bookmark) => {
        if (bookmark) {
          bookmarkEl.classList.add("active");
        }
      });
    }
  }

  /**
   * Toggle the lightbox view of an element.
   * @param {HTMLElement} el - The element to toggle.
   */
  function toggleLightbox(el) {
    el.parentElement.classList.toggle("lightbox");
    el.parentElement.classList.toggle("normal");
  }

  function init(root) {
    initCollapsibles(root);
    initSearch(root);
    initBookmarks(root);
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
    toggleLightbox,
    toggleBookmark,
    navToggle,
    tocToggle,
    searchToggle,
    search,
    qrcodeOpen,
    qrcodeClose,
    init,
  };
})();
