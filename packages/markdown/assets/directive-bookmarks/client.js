hyperbook.bookmarks = (function () {
  function update(root = document) {
    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "{}");

    const containerEls = root.getElementsByClassName("directive-bookmarks");
    for (let containerEl of containerEls) {
      const elements = [];
      Object.entries(bookmarks).forEach(([key, label]) => {
        const bookmarkEl = root.createElement("li");
        const link = root.createElement("a");
        link.href = key;
        link.innerHTML = label;
        bookmarkEl.append(link);
        elements.push(bookmarkEl);
      });
      containerEl.replaceChildren(...elements);
    }
  }

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    update(document);
  });

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.classList.contains("directive-bookmarks")) { // Element node
          update(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return {
    update,
  };
})();
