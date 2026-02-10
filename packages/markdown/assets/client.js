var hyperbook = Object.assign(window.hyperbook || {}, (function () {
  /**
   * Initialize elements within the given root element.
   * @param {HTMLElement} root - The root element to initialize.
   */
  const initCollapsibles = (root) => {
    // Handle both navigation sections and directive-collapsible elements
    const detailsEls = root.querySelectorAll("details.section, details.directive-collapsible");
    for (let details of detailsEls) {
      const id = details.getAttribute("data-id");

      // Prevent link clicks from toggling the details element in navigation
      if (id && id.startsWith("_nav:") && !details.classList.contains("empty")) {
        const link = details.querySelector("summary a");
        link?.addEventListener("click", (event) => {
          event.stopPropagation();
        });
      }

      // Listen for toggle events to persist state and sync with other elements
      details.addEventListener("toggle", () => {
        if (id) {
          if (details.open) {
            store.collapsibles.put({ id });
          } else {
            store.collapsibles.delete(id);
          }

          // Sync all elements with the same ID
          const allWithSameId = document.querySelectorAll(`[data-id="${id}"]`);
          for (let el of allWithSameId) {
            if (el !== details && el.tagName === "DETAILS") {
              el.open = details.open;
            }
          }
        }

        setTimeout(() => {
          window.dispatchEvent(new Event("resize")); // geogebra needs this to resize the applet
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
      const detailsEls = root.querySelectorAll("details.section, details.directive-collapsible");
      for (let details of detailsEls) {
        const id = details.getAttribute("data-id");
        if (id) {
          const shouldBeOpen = collapsibles.some((c) => c.id === id);
          // Only update if state differs and it's not a navigation section
          // (navigation sections are auto-expanded based on current page)
          if (!id.startsWith("_nav:") && details.open !== shouldBeOpen) {
            details.open = shouldBeOpen;
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
   * Open the share dialog.
   */
  function shareOpen() {
    const shareDialog = document.getElementById("share-dialog");
    shareUpdatePreview();
    shareDialog.showModal();
  }

  /**
   * Close the share dialog.
   */
  function shareClose() {
    const shareDialog = document.getElementById("share-dialog");
    shareDialog.close();
  }

  /**
   * Update the URL preview in the share dialog.
   */
  function shareUpdatePreview() {
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
  function shareCopyUrl() {
    const previewEl = document.getElementById("share-url-preview");
    const url = previewEl.textContent;
    
    navigator.clipboard.writeText(url).then(() => {
      const button = document.querySelector("#share-dialog .copy-button");
      const originalText = button.textContent;
      button.textContent = window.i18n.get("share-dialog-url-copied");
      
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
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
    const overlay = document.createElement("div");
    overlay.classList.add("lightbox-overlay");

    const captionText =
      el.parentElement.querySelector("figcaption")?.textContent || "";

    // container for image + caption
    const content = document.createElement("div");
    content.classList.add("lightbox-content");

    // image container fills remaining space
    const imgContainer = document.createElement("div");
    imgContainer.classList.add("lightbox-image-container");

    const lightboxImg = document.createElement("img");
    lightboxImg.src = el.src;
    imgContainer.appendChild(lightboxImg);

    content.appendChild(imgContainer);

    // add caption if exists
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

  function init(root) {
    initCollapsibles(root);
    initSearch(root);
    initBookmarks(root);
  }

  /**
   * Hide TOC toggle button when sections are filtered
   */
  function hideTocWhenFiltered() {
    const tocToggle = document.getElementById('toc-toggle');
    
    if (tocToggle) {
      tocToggle.style.display = 'none';
    }
  }

  // Filter sections based on query parameter
  function filterSections() {
    const urlParams = new URLSearchParams(window.location.search);
    const sectionsParam = urlParams.get('sections');
    
    if (!sectionsParam) {
      return; // No filtering needed
    }
    
    // Parse sections parameter (comma-separated list of IDs)
    const sectionIds = sectionsParam.split(',').map(id => id.trim()).filter(id => id);
    
    if (sectionIds.length === 0) {
      return; // No valid IDs provided
    }
    
    // Get all headings in the document
    const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingsArray = Array.from(allHeadings);
    
    // Build a map of which elements should be visible
    const visibleElements = new Set();
    
    sectionIds.forEach(sectionId => {
      // Find the heading with this ID
      const heading = document.getElementById(sectionId);
      if (!heading) {
        return; // ID not found
      }
      
      // Get the heading level (h1 = 1, h2 = 2, etc.)
      const headingLevel = parseInt(heading.tagName.substring(1));
      
      // Mark this heading as visible
      visibleElements.add(heading);
      
      // Find the index of this heading
      const headingIndex = headingsArray.indexOf(heading);
      if (headingIndex === -1) {
        return;
      }
      
      // Collect all elements until the next heading of the same or higher level
      let currentElement = heading.nextElementSibling;
      
      while (currentElement) {
        // Check if this is a heading
        const isHeading = /^H[1-6]$/.test(currentElement.tagName);
        
        if (isHeading) {
          const currentLevel = parseInt(currentElement.tagName.substring(1));
          
          // Stop if we hit a heading of the same or higher level (lower number)
          if (currentLevel <= headingLevel) {
            break;
          }
          
          // Include lower-level headings (subsections)
          visibleElements.add(currentElement);
        } else {
          // Include non-heading elements
          visibleElements.add(currentElement);
        }
        
        currentElement = currentElement.nextElementSibling;
      }
    });
    
    // Hide all elements that are not in visibleElements
    const markdownDiv = document.querySelector('main article .hyperbook-markdown');
    if (markdownDiv) {
      Array.from(markdownDiv.children).forEach(element => {
        // Don't hide UI elements (floating buttons container, side drawers)
        const isUIElement = element.id === 'floating-buttons-container' || 
                           element.tagName === 'SIDE-DRAWER';
        
        if (!visibleElements.has(element) && !isUIElement) {
          element.style.display = 'none';
        }
      });
      
      // Hide TOC toggle when sections are filtered
      hideTocWhenFiltered();
    }
  }

  // Check for standalone layout URL parameter or iframe context
  function checkStandaloneMode() {
    // Check if explicitly requested via URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const standaloneParam = urlParams.get('standalone') === 'true';
    
    // Check if page is inside an iframe (but not VSCode webview)
    const isVSCodeWebview = typeof acquireVsCodeApi !== 'undefined';
    const isInIframe = window.self !== window.top && !isVSCodeWebview;
    
    if (standaloneParam || isInIframe) {
      const mainGrid = document.querySelector('.main-grid');
      if (mainGrid && !mainGrid.classList.contains('layout-standalone')) {
        mainGrid.classList.add('layout-standalone');
      }
      
      // Hide TOC and QR code buttons when in standalone mode
      const tocToggle = document.getElementById('toc-toggle');
      if (tocToggle) {
        tocToggle.style.display = 'none';
      }
      
      const qrcodeOpen = document.getElementById('qrcode-open');
      if (qrcodeOpen) {
        qrcodeOpen.style.display = 'none';
      }
    }
  }

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
    checkStandaloneMode();
    filterSections();
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

  // User authentication functions (delegate to cloud.js IIFE)
  const userToggle = () => {
    if (window.hyperbook.cloud) {
      window.hyperbook.cloud.userToggle();
    }
  };

  const doLogin = async () => {
    if (window.hyperbook.cloud) {
      await window.hyperbook.cloud.doLogin();
    }
  };

  const doLogout = () => {
    if (window.hyperbook.cloud) {
      window.hyperbook.cloud.doLogout();
    }
  };

  return {
    toggleLightbox,
    toggleBookmark,
    navToggle,
    tocToggle,
    searchToggle,
    search,
    qrcodeOpen,
    qrcodeClose,
    shareOpen,
    shareClose,
    shareUpdatePreview,
    shareCopyUrl,
    userToggle,
    doLogin,
    doLogout,
    init,
  };
})());
