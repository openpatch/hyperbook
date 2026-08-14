/// <reference path="../hyperbook.types.js" />

/**
 * Java Memory Playground: keeps what the reader builds, and puts the author's
 * diagram back when they ask for it.
 * @type {HyperbookJmp}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.jmp = (function () {
  /** A drag is a stream of edits; only the last one is worth a write. */
  const debounce = (fn, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  };

  /**
   * Persist what the reader builds.
   *
   * `edit` fires on every edit, `change` only when they press save. Listening
   * for both means work is never lost, and that a book built against a
   * component too old for `edit` still keeps what was saved.
   */
  const listen = (playground, id) => {
    const save = debounce((event) => {
      hyperbook.store.db.jmp.put({
        id,
        memory: JSON.stringify(event.detail),
      });
    }, 300);
    playground.addEventListener("edit", save);
    playground.addEventListener("change", save);
  };

  async function init(root) {
    const elems = root.getElementsByClassName("directive-jmp");

    for (let elem of elems) {
      let playground = elem.getElementsByTagName("java-memory-playground")[0];
      if (!playground) continue;

      // The author's diagram, as an empty element carrying the attributes the
      // page was rendered with. Taken before saved state overwrites them, and
      // without children, since the component has already rendered into them.
      //
      // Reset swaps this in rather than rewriting the `memory` attribute: the
      // component reloads when that attribute *changes*, and a reader who has
      // edited an unsaved diagram is looking at one whose attribute still holds
      // the original — writing it again would change nothing.
      const pristine = playground.cloneNode(false);

      const saved = await hyperbook.store.db.jmp.get(elem.id);
      if (saved) {
        playground.setAttribute("memory", saved.memory);
      }
      listen(playground, elem.id);

      const reset = elem.getElementsByClassName("reset")[0];
      if (reset) {
        reset.addEventListener("click", async () => {
          if (!window.confirm(hyperbook.i18n.get("jmp-reset-prompt"))) return;
          await hyperbook.store.db.jmp.delete(elem.id);
          const fresh = pristine.cloneNode(false);
          playground.replaceWith(fresh);
          playground = fresh;
          listen(playground, elem.id);
        });
      }
    }
  }

  // Initialize existing elements on document load
  document.addEventListener("DOMContentLoaded", () => {
    init(document);
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

  return {
    init,
  };
})();
