/// <reference path="../hyperbook.types.js" />

/**
 * Bitflow: keeps the reader's attempt, and starts a fresh one when they ask.
 *
 * bitflow itself never stores anything — it publishes a snapshot on every
 * durable change and accepts one back. This is the host half of that contract:
 * store the snapshot under the directive's id, hand it back on the next visit.
 * @type {HyperbookBitflow}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.bitflow = (function () {
  /** Answering is a stream of edits; only the last one is worth a write. */
  const debounce = (fn, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  };

  const listen = (flow, id) => {
    const save = debounce((event) => {
      // The snapshot is stored as an object, not as JSON text. Assigning a
      // string to the element's `attempt` property would send it through
      // JSON.stringify on its way to the attribute and JSON.parse on the way
      // back — a round trip that happens to return the same string, and leaves
      // a doubly-encoded attribute in the DOM to show for it.
      hyperbook.store.db.bitflow.put({ id, attempt: event.detail });
    }, 300);
    // `bitflow-statechange` is every durable change and `bitflow-save` an
    // explicit one; both carry the whole snapshot, so either is enough on its
    // own and listening for both costs nothing but a debounced write.
    flow.addEventListener("bitflow-statechange", save);
    flow.addEventListener("bitflow-save", save);
  };

  async function init(root) {
    const elems = root.getElementsByClassName("directive-bitflow");
    if (elems.length === 0) return;

    // The element is defined by an ES module, which runs after this deferred
    // script. Assigning `attempt` to an element that has not upgraded yet
    // would create an own property shadowing the accessor the upgrade installs,
    // and the attempt would be silently dropped.
    await customElements.whenDefined("bitflow-flow");

    for (let elem of elems) {
      let flow = elem.getElementsByTagName("bitflow-flow")[0];
      if (!flow) continue;

      // The author's document, as an empty element carrying the attributes the
      // page was rendered with. Taken before the restored attempt touches it.
      const pristine = flow.cloneNode(false);

      const saved = await hyperbook.store.db.bitflow.get(elem.id);
      if (saved) {
        // A snapshot from a since-edited document is rejected by the element,
        // which reports `bitflow-error` and leaves the fresh attempt standing —
        // so a reader whose book was rebuilt sees the assessment, not a blank.
        flow.attempt = saved.attempt;
      }
      listen(flow, elem.id);

      const reset = elem.getElementsByClassName("reset")[0];
      if (reset) {
        reset.addEventListener("click", async () => {
          if (!window.confirm(hyperbook.i18n.get("bitflow-reset-prompt")))
            return;
          await hyperbook.store.db.bitflow.delete(elem.id);
          // Replaced rather than reset in place: `reset()` starts a new attempt
          // but leaves the element's `attempt` property holding the snapshot
          // just deleted, which the next render would restore.
          const fresh = pristine.cloneNode(false);
          flow.replaceWith(fresh);
          flow = fresh;
          listen(flow, elem.id);
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
