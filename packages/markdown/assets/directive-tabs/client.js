hyperbook.tabs = (function () {
  const init = (root) => {
    let allTabs = root.querySelectorAll(".directive-tabs .tab[data-tabs-id]");
    allTabs.forEach((tab) => {
      const tabsId = tab.getAttribute("data-tabs-id");
      const tabId = tab.getAttribute("data-tab-id");
      tab.addEventListener("click", () => {
        store.tabs.put({
          id: tabsId,
          active: tabId,
        });
        selectTab(tabsId, tabId);
      });
    });
    store.tabs.each((result) => {
      selectTab(result.id, result.active);
    });
  };

  function selectTab(tabsId, tabId) {
    let relevantTabButtons = document.querySelectorAll(
      `.directive-tabs .tab[data-tabs-id="${tabsId}"]`
    );
    relevantTabButtons.forEach((e) => {
      e.className = e.className.replace(" active", "");
      if (e.getAttribute("data-tab-id") == tabId) {
        e.className += " active";
      }
    });
    let relevantTabPanels = document.querySelectorAll(
      `.directive-tabs .tabpanel[data-tabs-id="${tabsId}"]`
    );
    relevantTabPanels.forEach((e) => {
      e.className = e.className.replace(" active", "");
      if (e.getAttribute("data-tab-id") == tabId) {
        e.className += " active";
      }
    });
  }

  init(document.body);

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
