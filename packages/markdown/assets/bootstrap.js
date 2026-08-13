/// <reference path="./hyperbook.types.js" />
window.hyperbook = window.hyperbook || {};

/**
 * Bootstrap script: initializes collapsibles, search, bookmarks,
 * standalone mode, and section filtering on DOMContentLoaded.
 * @type {HyperbookBootstrap}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.bootstrap = (function () {
  /**
   * Initialize collapsible elements within the given root.
   * @param {HTMLElement} root
   */
  const initCollapsibles = (root) => {
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
            hyperbook.store.db.collapsibles.put({ id });
          } else {
            hyperbook.store.db.collapsibles.delete(id);
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
          window.dispatchEvent(new Event("resize"));
        }, 100);
      });
    }
    updateCollapsibles(root);
  };

  /**
   * Restore collapsible open/close state from the store.
   * @param {HTMLElement} root
   */
  const updateCollapsibles = (root) => {
    hyperbook.store.db.collapsibles.toArray().then((collapsibles) => {
      const detailsEls = root.querySelectorAll("details.section, details.directive-collapsible");
      for (let details of detailsEls) {
        const id = details.getAttribute("data-id");
        if (id) {
          const shouldBeOpen = collapsibles.some((c) => c.id === id);
          if (!id.startsWith("_nav:") && details.open !== shouldBeOpen) {
            details.open = shouldBeOpen;
          }
        }
      }
    });
  };

  /**
   * Initialize search input key handling.
   * @param {HTMLElement} root
   */
  const initSearch = (root) => {
    const searchInputEl = root.querySelector("#search-input");
    if (!searchInputEl) return;

    searchInputEl.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        hyperbook.ui.search();
      }
    });

    // Search-as-you-type. Only worthwhile because the index is parsed once and
    // kept in memory; it used to be rebuilt on every query.
    let debounce;
    searchInputEl.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => hyperbook.ui.search(), 150);
    });

    // "/" focuses search from anywhere, the convention on documentation sites.
    document.addEventListener("keydown", (event) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const active = document.activeElement;
      const tag = active?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        active?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      const searchDrawerEl = document.getElementById("search-drawer");
      if (searchDrawerEl && !searchDrawerEl.open) {
        hyperbook.ui.searchToggle();
      } else {
        searchInputEl.focus();
      }
    });
  };

  /**
   * Initialize bookmark active states within the given root.
   * @param {HTMLElement} [root=document]
   */
  function initBookmarks(root = document) {
    const bookmarkEls = root.getElementsByClassName("bookmark");
    for (let bookmarkEl of bookmarkEls) {
      const key = bookmarkEl.getAttribute("data-key");
      hyperbook.store.db.bookmarks.get(key).then((bookmark) => {
        if (bookmark) {
          bookmarkEl.classList.add("active");
          bookmarkEl.setAttribute("aria-pressed", "true");
        }
      });
    }
  }

  /**
   * Bookmark buttons are handled by one delegated listener, so headings that
   * are added later work too and no heading has to carry its label in an
   * inline script.
   */
  document.addEventListener("click", (event) => {
    const bookmarkEl = event.target.closest?.("button.bookmark");
    const key = bookmarkEl?.getAttribute("data-key");
    if (key) {
      hyperbook.ui.toggleBookmark(key);
    }
  });

  /**
   * Initialize all hyperbook elements within a root.
   * @param {HTMLElement} root
   */
  function init(root) {
    initCollapsibles(root);
    initSearch(root);
    initBookmarks(root);
  }

  /**
   * Hide TOC toggle button when sections are filtered.
   */
  function hideTocWhenFiltered() {
    const tocToggle = document.getElementById('toc-toggle');
    if (tocToggle) {
      tocToggle.style.display = 'none';
    }
  }

  /**
   * Filter sections based on the `sections` query parameter.
   */
  function filterSections() {
    const urlParams = new URLSearchParams(window.location.search);
    const sectionsParam = urlParams.get('sections');
    
    if (!sectionsParam) {
      return;
    }
    
    const sectionIds = sectionsParam.split(',').map(id => id.trim()).filter(id => id);
    
    if (sectionIds.length === 0) {
      return;
    }
    
    const allHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const headingsArray = Array.from(allHeadings);
    
    const visibleElements = new Set();
    
    sectionIds.forEach(sectionId => {
      const heading = document.getElementById(sectionId);
      if (!heading) {
        return;
      }
      
      const headingLevel = parseInt(heading.tagName.substring(1));
      
      visibleElements.add(heading);
      
      const headingIndex = headingsArray.indexOf(heading);
      if (headingIndex === -1) {
        return;
      }
      
      let currentElement = heading.nextElementSibling;
      
      while (currentElement) {
        const isHeading = /^H[1-6]$/.test(currentElement.tagName);
        
        if (isHeading) {
          const currentLevel = parseInt(currentElement.tagName.substring(1));
          
          if (currentLevel <= headingLevel) {
            break;
          }
          
          visibleElements.add(currentElement);
        } else {
          visibleElements.add(currentElement);
        }
        
        currentElement = currentElement.nextElementSibling;
      }
    });
    
    const markdownDiv = document.querySelector('main article .hyperbook-markdown');
    if (markdownDiv) {
      Array.from(markdownDiv.children).forEach(element => {
        const isUIElement = element.id === 'floating-buttons-container' || 
                           element.tagName === 'SIDE-DRAWER';
        
        if (!visibleElements.has(element) && !isUIElement) {
          element.style.display = 'none';
        }
      });
      
      hideTocWhenFiltered();
    }
  }

  /**
   * Check for standalone layout URL parameter or iframe context.
   */
  function checkStandaloneMode() {
    const urlParams = new URLSearchParams(window.location.search);
    const standaloneParam = urlParams.get('standalone') === 'true';
    
    const isVSCodeWebview = typeof acquireVsCodeApi !== 'undefined';
    const isInIframe = window.self !== window.top && !isVSCodeWebview;
    
    if (standaloneParam || isInIframe) {
      const mainGrid = document.querySelector('.main-grid');
      if (mainGrid && !mainGrid.classList.contains('layout-standalone')) {
        mainGrid.classList.add('layout-standalone');
      }
      
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

  /**
   * Grow every textarea to fit its content while printing.
   *
   * A textarea scrolls its overflow rather than growing, and CSS `height: auto`
   * resolves to the element's default row count, not its content. So without
   * this a student's written answer prints truncated to the first few lines.
   * The inline heights are restored afterwards so the screen layout is
   * untouched.
   */
  const initPrintExpansion = () => {
    /** @type {Map<HTMLTextAreaElement, string>} */
    const previousHeights = new Map();

    const expand = () => {
      for (const textarea of document.querySelectorAll("textarea")) {
        // Chromium fires both `beforeprint` and the media query change, so
        // this runs twice per print. Without the guard the second pass would
        // record the already-expanded height as the original, and `restore`
        // would leave every textarea stretched on screen afterwards.
        if (!previousHeights.has(textarea)) {
          previousHeights.set(textarea, textarea.style.height);
        }
        textarea.style.height = "auto";
        // scrollHeight is only meaningful once the height constraint is gone.
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    };

    const restore = () => {
      for (const [textarea, height] of previousHeights) {
        textarea.style.height = height;
      }
      previousHeights.clear();
    };

    window.addEventListener("beforeprint", expand);
    window.addEventListener("afterprint", restore);

    // Safari and some print-to-PDF paths fire the media query instead of the
    // events above.
    const printQuery = window.matchMedia?.("print");
    printQuery?.addEventListener?.("change", (event) =>
      event.matches ? expand() : restore(),
    );
  };

  // Initialize on DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
    checkStandaloneMode();
    filterSections();
    initPrintExpansion();
  });

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          init(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return { init };
})();
