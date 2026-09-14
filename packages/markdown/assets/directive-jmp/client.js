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

  /** The label and the pressed look follow whatever the browser is doing. */
  const updateFullscreenButton = (elem, button) => {
    if (!button) return;
    const isFullscreen = document.fullscreenElement === elem;
    const label = hyperbook.i18n.get(
      isFullscreen ? "ide-fullscreen-exit" : "ide-fullscreen-enter",
    );
    button.title = label;
    button.setAttribute("aria-label", label);
    button.classList.toggle("active", isFullscreen);
  };

  const syncFullscreenButtons = () => {
    for (const elem of document.getElementsByClassName("directive-jmp")) {
      updateFullscreenButton(elem, elem.querySelector("button.fullscreen"));
    }
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

      // The whole figure goes fullscreen, not the component: the reset and
      // fullscreen buttons live outside it and would be left behind on the
      // page otherwise.
      const fullscreen = elem.getElementsByClassName("fullscreen")[0];
      if (fullscreen) {
        fullscreen.addEventListener("click", async () => {
          if (document.fullscreenElement === elem) {
            await document.exitFullscreen();
          } else {
            await elem.requestFullscreen();
          }
        });
        updateFullscreenButton(elem, fullscreen);
      }

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

  // Escape and F11 leave fullscreen without going through the button, so the
  // button's state is read back from the browser rather than tracked.
  document.addEventListener("fullscreenchange", syncFullscreenButtons);

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
