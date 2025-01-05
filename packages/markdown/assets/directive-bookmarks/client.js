hyperbook.bookmarks = (function () {
  function update(root = document) {
    store.bookmarks
      .toArray()
      .then((bookmarks) => {
        return bookmarks.map((bookmark) => {
          const bookmarkEl = root.createElement("li");
          const link = root.createElement("a");
          link.href = bookmark.path;
          link.innerHTML = bookmark.label;
          bookmarkEl.append(link);
          return bookmarkEl;
        });
      })
      .then((elements) => {
        const containerEls = root.getElementsByClassName("directive-bookmarks");
        for (let containerEl of containerEls) {
          containerEl.replaceChildren(...elements);
        }
      });
  }

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    update(document);
  });

  // Observe for new elements added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.nodeType === 1 &&
          node.classList.contains("directive-bookmarks")
        ) {
          // Element node
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
