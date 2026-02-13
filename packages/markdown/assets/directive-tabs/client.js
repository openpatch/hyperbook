/// <reference path="../hyperbook.types.js" />

/**
 * Tabbed content panels with state persistence.
 * @type {HyperbookTabs}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.tabs = (function () {
  const init = (root) => {
    // Find all radio inputs for tabs
    let allTabInputs = root.querySelectorAll(".directive-tabs .tab-input[data-tabs-id]");
    allTabInputs.forEach((input) => {
      const tabsId = input.getAttribute("data-tabs-id");
      const tabId = input.getAttribute("data-tab-id");
      
      // Listen for changes on radio inputs
      input.addEventListener("change", () => {
        if (input.checked) {
          hyperbook.store.tabs.put({
            id: tabsId,
            active: tabId,
          });
          
          // Sync all radio inputs with the same tabs-id and tab-id
          syncAllTabs(tabsId, tabId);
        }
      });
    });
    
    // Restore saved tab selections
    hyperbook.store.tabs.each((result) => {
      selectTab(result.id, result.active);
    });
  };

  function syncAllTabs(tabsId, tabId) {
    // Find all radio inputs with the same tabs-id and tab-id across the page
    const allMatchingInputs = document.querySelectorAll(
      `.directive-tabs .tab-input[data-tabs-id="${tabsId}"][data-tab-id="${tabId}"]`
    );
    
    allMatchingInputs.forEach((input) => {
      input.checked = true;
    });
  }

  function selectTab(tabsId, tabId) {
    // Sync all tabs with this combination
    syncAllTabs(tabsId, tabId);
  }

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
  });

  // Observe for new tabs added to the DOM
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
    selectTab,
    init,
  };
})();
