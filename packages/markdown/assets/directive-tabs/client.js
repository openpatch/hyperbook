hyperbook.tabs = (function () {
  let allTabs = document.querySelectorAll(".directive-tabs .tab[data-tabs-id]");

  allTabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      selectTab(
        tab.getAttribute("data-tabs-id"),
        tab.getAttribute("data-tab-id"),
      );
    }),
  );

  function selectTab(tabsId, tabId) {
    let relevantTabButtons = document.querySelectorAll(
      `.directive-tabs .tab[data-tabs-id="${tabsId}"]`,
    );
    relevantTabButtons.forEach((e) => {
      e.className = e.className.replace(" active", "");
      if (e.getAttribute("data-tab-id") == tabId) {
        e.className += " active";
      }
    });
    let relevantTabPanels = document.querySelectorAll(
      `.directive-tabs .tabpanel[data-tabs-id="${tabsId}"]`,
    );
    relevantTabPanels.forEach((e) => {
      e.className = e.className.replace(" active", "");
      if (e.getAttribute("data-tab-id") == tabId) {
        e.className += " active";
      }
    });
  }

  return {
    selectTab,
  };
})();
