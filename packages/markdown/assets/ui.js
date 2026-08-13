/// <reference path="./hyperbook.types.js" />
window.hyperbook = window.hyperbook || {};

/**
 * Core UI functions called from onclick handlers in the generated HTML.
 * @type {HyperbookUI}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.ui = (function () {
  /**
   * Toggle the lightbox view of an element.
   * @param {HTMLElement} el - The image element to display.
   */
  function toggleLightbox(el) {
    const overlay = document.createElement("div");
    overlay.classList.add("lightbox-overlay");

    const captionText =
      el.parentElement.querySelector("figcaption")?.textContent || "";

    const content = document.createElement("div");
    content.classList.add("lightbox-content");

    const imgContainer = document.createElement("div");
    imgContainer.classList.add("lightbox-image-container");

    const lightboxImg = document.createElement("img");
    lightboxImg.src = el.src;
    imgContainer.appendChild(lightboxImg);

    content.appendChild(imgContainer);

    if (captionText) {
      const caption = document.createElement("div");
      caption.classList.add("caption");
      caption.textContent = captionText;
      content.appendChild(caption);
    }

    overlay.appendChild(content);

    overlay.addEventListener("click", () => {
      document.body.removeChild(overlay);
    });

    document.body.appendChild(overlay);
    overlay.style.display = "flex";
  }

  /**
   * Read the label of a heading as bookmark parts. Reading it from the
   * rendered heading instead of the markup keeps whatever the page shows,
   * so an emoji that is drawn as an image stays an image in the bookmark
   * list. Emojis are stored by id, never by URL, so bookmarks survive a
   * change of the basePath.
   * @param {Element} [buttonEl] - The bookmark button of the heading.
   * @returns {HyperbookBookmarkLabel} The label parts.
   */
  function readBookmarkLabel(buttonEl) {
    const labelEl = buttonEl?.parentElement?.querySelector("a.heading > span");
    const label = [];
    for (let node of labelEl ? labelEl.childNodes : []) {
      if (node.nodeName === "IMG" && node.dataset.emoji) {
        label.push({ text: node.alt || "", emoji: node.dataset.emoji });
      } else if (node.textContent) {
        label.push({ text: node.textContent });
      }
    }
    if (label.length === 0) {
      const fallback = buttonEl?.getAttribute("data-label");
      if (fallback) {
        label.push({ text: fallback });
      }
    }
    return label;
  }

  /**
   * Toggle a bookmark on/off.
   * @param {string} key - The bookmark path key.
   */
  function toggleBookmark(key) {
    const el = document.querySelectorAll(`.bookmark[data-key="${key}"]`);
    hyperbook.store.db.bookmarks.get(key).then((bookmark) => {
      if (!bookmark) {
        const label = readBookmarkLabel(el[0]);
        hyperbook.store.db.bookmarks.add({ path: key, label }).then(() => {
          el.forEach((e) => {
            e.classList.add("active");
            e.setAttribute("aria-pressed", "true");
          });
          hyperbook.bookmarks.update();
        });
      } else {
        hyperbook.store.db.bookmarks.delete(key).then(() => {
          el.forEach((e) => {
            e.classList.remove("active");
            e.setAttribute("aria-pressed", "false");
          });
          hyperbook.bookmarks.update();
        });
      }
    });
  }

  /**
   * Toggle the navigation drawer.
   */
  function navToggle() {
    const navDrawerEl = document.getElementById("nav-drawer");
    navDrawerEl.open = !navDrawerEl.open;
  }

  /**
   * Toggle the table of contents drawer.
   */
  function tocToggle() {
    const tocDrawerEl = document.getElementById("toc-drawer");
    tocDrawerEl.open = !tocDrawerEl.open;
  }

  /**
   * Resolves once lunr, the stemmers and the index module are all in memory.
   * Memoized: the index is parsed once per page, not once per query.
   * @type {Promise<{index: any, documents: Object}> | null}
   */
  let searchReady = null;

  /**
   * Load a classic (non-module) script and resolve when it has run.
   * @param {string} src
   * @returns {Promise<void>}
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Fetch the search payload on demand. The index is several megabytes for a
   * large book, so it is deliberately kept off the initial page load.
   * @returns {Promise<{index: any, documents: Object}>}
   */
  function loadSearch() {
    if (searchReady) return searchReady;

    const configEl = document.getElementById("hyperbook-search-config");
    if (!configEl) {
      searchReady = Promise.reject(new Error("Search is not enabled"));
      return searchReady;
    }
    const config = JSON.parse(configEl.textContent);

    searchReady = (async () => {
      await loadScript(config.lunr);
      // Stemmer support must run before the language plugin that uses it.
      for (const src of config.languages || []) {
        await loadScript(src);
      }
      const mod = await import(config.index);
      return {
        index: window.lunr.Index.load(mod.LUNR_INDEX),
        documents: mod.SEARCH_DOCUMENTS,
      };
    })();

    return searchReady;
  }

  /**
   * Toggle the search drawer, starting the index download on first open.
   */
  function searchToggle() {
    const searchDrawerEl = document.getElementById("search-drawer");
    searchDrawerEl.open = !searchDrawerEl.open;
    if (searchDrawerEl.open) {
      loadSearch().catch(() => {});
      const searchInputEl = document.querySelector("#search-input");
      if (searchInputEl) searchInputEl.focus();
    }
  }

  /**
   * Perform a search and display the results.
   * @returns {Promise<void>}
   */
  async function search() {
    const resultsEl = document.getElementById("search-results");
    const searchInputEl = document.querySelector("#search-input");
    const query = searchInputEl.value;

    if (!query.trim()) {
      resultsEl.innerHTML = "";
      return;
    }

    let index;
    let documents;
    try {
      // Only show a loading state if the payload is not already resident,
      // otherwise every keystroke would flash it.
      const pending = loadSearch();
      let settled = false;
      pending.then(
        () => (settled = true),
        () => (settled = true),
      );
      await Promise.resolve();
      if (!settled) {
        resultsEl.textContent = hyperbook.i18n.get("shell-search-loading");
      }
      ({ index, documents } = await pending);
    } catch (e) {
      console.error("Failed to load search:", e);
      resultsEl.textContent = hyperbook.i18n.get("shell-search-failed");
      return;
    }

    // The input may have moved on while the index was downloading.
    if (searchInputEl.value !== query) return;

    resultsEl.innerHTML = "";

    // lunr exposes a query syntax (`~`, `*`, `+`, `field:term`). A partially
    // typed expression either throws or silently matches nothing, and with
    // search-as-you-type the reader passes through those states on the way to
    // an ordinary word. Retry such a query with the operators stripped.
    const LUNR_OPERATORS = /[:~^*+-]/;

    /** @returns {any[]} */
    const literalSearch = () => {
      try {
        return index.query((q) => {
          for (const raw of query.split(/\s+/)) {
            const term = raw.replace(new RegExp(LUNR_OPERATORS, "g"), "");
            if (term) q.term(term, { usePipeline: true });
          }
        });
      } catch {
        return [];
      }
    };

    let results;
    try {
      results = index.search(query);
      if (results.length === 0 && LUNR_OPERATORS.test(query)) {
        results = literalSearch();
      }
    } catch (e) {
      results = literalSearch();
    }

    if (results.length === 0) {
      resultsEl.textContent = hyperbook.i18n.get("shell-search-no-results", {
        query,
      });
      return;
    }

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

  return {
    toggleLightbox,
    toggleBookmark,
    navToggle,
    tocToggle,
    searchToggle,
    loadSearch,
    search,
  };
})();

/**
 * QR code dialog functions.
 * @type {HyperbookQrcode}
 * @memberof hyperbook
 */
hyperbook.qrcode = (function () {
  /**
   * Open the QR code dialog.
   */
  function open() {
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
  function close() {
    const qrCodeDialog = document.getElementById("qrcode-dialog");
    qrCodeDialog.close();
  }

  return { open, close };
})();

/**
 * Share dialog functions.
 * @type {HyperbookShare}
 * @memberof hyperbook
 * @see hyperbook.i18n
 */
hyperbook.share = (function () {
  /**
   * Open the share dialog.
   */
  function open() {
    const shareDialog = document.getElementById("share-dialog");
    updatePreview();
    shareDialog.showModal();
  }

  /**
   * Close the share dialog.
   */
  function close() {
    const shareDialog = document.getElementById("share-dialog");
    shareDialog.close();
  }

  /**
   * Update the URL preview in the share dialog.
   */
  function updatePreview() {
    const standaloneCheckbox = document.getElementById("share-standalone-checkbox");
    const sectionCheckboxes = document.querySelectorAll("#share-dialog input[data-anchor]");
    const previewEl = document.getElementById("share-url-preview");
    
    const baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    
    if (standaloneCheckbox && standaloneCheckbox.checked) {
      params.append("standalone", "true");
    }
    
    const selectedSections = Array.from(sectionCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.getAttribute("data-anchor"));
    
    if (selectedSections.length > 0) {
      params.append("sections", selectedSections.join(","));
    }
    
    const finalUrl = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
    previewEl.textContent = finalUrl;
  }

  /**
   * Copy the shareable URL to clipboard.
   */
  function copyUrl() {
    const previewEl = document.getElementById("share-url-preview");
    const url = previewEl.textContent;
    
    navigator.clipboard.writeText(url).then(() => {
      const button = document.querySelector("#share-dialog .copy-button");
      const originalText = button.textContent;
      button.textContent = hyperbook.i18n.get("share-dialog-url-copied");
      
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    });
  }

  return { open, close, updatePreview, copyUrl };
})();
