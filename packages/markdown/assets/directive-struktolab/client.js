/// <reference path="../hyperbook.types.js" />

/**
 * @type {HyperbookStruktolab}
 * @memberof hyperbook
 * @see hyperbook.store
 */
hyperbook.struktolab = (function () {
  const init = (root) => {
    let allStruktolabEditors = root.querySelectorAll("struktolab-editor");

    allStruktolabEditors.forEach((editor) => {
      // The observer below hands nodes over again; wire each editor once.
      if (editor.dataset.hyperbookInit) return;
      editor.dataset.hyperbookInit = "1";
      const editorId = editor.getAttribute("data-id");

      const reset = editor
        .closest(".directive-struktolab")
        ?.querySelector(".struktolab-reset");
      reset?.addEventListener("click", async () => {
        if (!window.confirm(hyperbook.i18n.get("struktolab-reset-prompt")))
          return;
        await hyperbook.store.db.struktolab.delete(editorId);
        await restoreOriginal(editor);
      });

      // struktolab 0.8 saves the whole document: the tree, the code
      // language and the code the student typed. Older versions only had
      // the tree.
      const withDocuments = typeof editor.toDocument === "function";

      // Load saved content for this editor
      hyperbook.store.db.struktolab.get(editorId).then((result) => {
        if (!result) return;
        if (result.document && withDocuments) {
          const doc = JSON.parse(result.document);
          // The student's structogram and code — but the page's view
          // settings (font size, colours, scale), which the author may have
          // changed since.
          editor.fromDocument({
            ...doc,
            settings: { codeMode: doc.settings && doc.settings.codeMode },
          });
        } else if (result.tree) {
          editor.loadJSON(JSON.parse(result.tree));
        }
      });

      // Listen for changes in the editor
      editor.addEventListener("change", (e) => {
        hyperbook.store.db.struktolab.put({
          id: editorId,
          tree: JSON.stringify(e.detail.tree),
          ...(withDocuments
            ? { document: JSON.stringify(editor.toDocument()) }
            : {}),
        });
      });
    });
  };

  /**
   * The structogram the page started with: the code block the author wrote
   * (it stays in the editor as a <script>), else the `src` file, else an
   * empty one.
   * @param {HTMLElement & Record<string, any>} editor
   */
  const restoreOriginal = async (editor) => {
    const script = editor.querySelector(":scope > script");
    if (script) {
      const language = script.dataset.code || "pseudocode";
      editor.loadCode(script.textContent || "", language);
      return;
    }
    const src = editor.getAttribute("src");
    if (src) {
      try {
        const doc = await fetch(src).then((r) => r.json());
        if (typeof editor.fromDocument === "function") editor.fromDocument(doc);
        else editor.loadJSON(doc);
        return;
      } catch (e) {
        console.error("Failed to load the structogram's src:", e);
      }
    }
    editor.loadCode("", editor.codeMode || "pseudocode");
  };

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
    init,
  };
})();
