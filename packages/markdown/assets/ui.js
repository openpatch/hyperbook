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
   * Toggle a bookmark on/off.
   * @param {string} key - The bookmark path key.
   * @param {string} label - The bookmark label.
   */
  function toggleBookmark(key, label) {
    const el = document.querySelectorAll(`.bookmark[data-key="${key}"]`);
    hyperbook.store.bookmarks.get(key).then((bookmark) => {
      if (!bookmark) {
        hyperbook.store.bookmarks.add({ path: key, label }).then(() => {
          el.forEach((e) => e.classList.add("active"));
          hyperbook.bookmarks.update();
        });
      } else {
        hyperbook.store.bookmarks.delete(key).then(() => {
          el.forEach((e) => e.classList.remove("active"));
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

  return {
    toggleLightbox,
    toggleBookmark,
    navToggle,
    tocToggle,
    searchToggle,
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
