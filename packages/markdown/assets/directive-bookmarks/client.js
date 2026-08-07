/// <reference path="../hyperbook.types.js" />

/**
 * Bookmark management and navigation.
 * @type {HyperbookBookmarks}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.bookmarks = (function () {
  /**
   * Render a stored label into a link. Labels are built from parts instead of
   * markup, so nothing that was persisted is ever parsed as HTML.
   * @param {Element} link
   * @param {HyperbookBookmarkLabel | string} label
   */
  function renderLabel(link, label) {
    // Bookmarks saved before labels became parts.
    if (typeof label === "string") {
      link.textContent = label;
      return;
    }
    for (let part of label || []) {
      if (part.emoji && hyperbook.emoji?.base) {
        const img = document.createElement("img");
        img.className = "emoji";
        img.src = `${hyperbook.emoji.base}/${part.emoji}.svg`;
        img.alt = part.text || "";
        img.draggable = false;
        link.append(img);
      } else if (part.text) {
        link.append(document.createTextNode(part.text));
      }
    }
  }

  function update(root = document) {
    hyperbook.store.db.bookmarks
      .toArray()
      .then((bookmarks) => {
        return bookmarks.map((bookmark) => {
          const bookmarkEl = root.createElement("li");
          const link = root.createElement("a");
          link.href = bookmark.path;
          renderLabel(link, bookmark.label);
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
