/// <reference path="./hyperbook.types.js" />
window.hyperbook = window.hyperbook || {};

/**
 * Persistent store backed by Dexie (IndexedDB).
 * Provides table access, import/export, and reset functionality.
 * @type {HyperbookStore}
 * @memberof hyperbook
 * @see hyperbook.i18n
 * @see hyperbook.cloud
 */
hyperbook.store = (function () {
  /** @type {import("dexie").Dexie} */
  var db = new Dexie("Hyperbook");
  db.version(2).stores({
    currentState: `
              id,
              path,
              mouseX,
              mouseY,
              scrollX,
              scrollY,
              windowWidth,
              windowHeight
    `,
    collapsibles: `id`,
    abcMusic: `id,tune`,
    audio: `id,time`,
    bookmarks: `path,label`,
    p5: `id,sketch`,
    protect: `id,passwordHash`,
    pyide: `id,script`,
    slideshow: `id,active`,
    tabs: `id,active`,
    excalidraw: `id,excalidrawElements,appState,files`,
    webide: `id,html,css,js`,
    h5p: `id,userData`,
    geogebra: `id,state`,
    learningmap: `id,nodes,x,y,zoom`,
    textinput: `id,text`,
    custom: `id,payload`,
    onlineide: `scriptId,script`,
    sqlideScripts: `scriptId,script`,
    sqlideDatabases: `databaseId,database`,
    multievent: `id,state`,
    typst: `id,code`,
  });

  /** @returns {Promise<void>} */
  const init = async () => {
    db.currentState.put({
      id: 1,
      path: window.location.pathname,
      mouseX: 0,
      mouseY: 0,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });
    window.addEventListener("mousemove", (e) => {
      db.currentState.update(1, { mouseX: e.clientX, mouseY: e.clientY });
    });
    window.addEventListener("scroll", (e) => {
      db.currentState.update(1, {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      });
    });
    window.addEventListener("resize", (e) => {
      db.currentState.update(1, {
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      });
    });
  };

  init();

  /**
   * Export all store data as a JSON file download.
   * @returns {Promise<void>}
   */
  async function hyperbookExport() {
    const exp = await db.export({ prettyJson: true });

    const data = {
      version: 1,
      origin: window.location.origin,
      data: {
        hyperbook: JSON.parse(await exp.text()),
      },
    };

    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `hyperbook-export-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all store data after user confirmation.
   * Syncs the reset to the cloud if connected.
   * @returns {Promise<void>}
   */
  async function hyperbookReset() {
    async function clearTable(database) {
      for (const table of database.tables) {
        await table.clear();
      }
    }

    if (!confirm(hyperbook.i18n.get("store-reset-confirm"))) {
      return;
    }

    clearTable(db);

    // Send empty snapshot to cloud
    if (hyperbook.cloud) {
      try {
        await hyperbook.cloud.sendSnapshot();
      } catch (e) {
        console.error("Failed to sync reset to cloud:", e);
      }
    }

    alert(hyperbook.i18n.get("store-reset-sucessful"));
    window.location.reload();
  }

  /**
   * Import store data from a user-selected JSON file.
   * Syncs the import to the cloud if connected.
   * @returns {Promise<void>}
   */
  async function hyperbookImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = JSON.parse(e.target.result);
        if (data.origin !== window.location.origin) {
          if (
            !confirm(hyperbook.i18n.get("store-different-origin", { origin: data.origin }))
          ) {
            return;
          }
        }
        if (data.version !== 1) {
          alert(
            hyperbook.i18n.get("store-not-supported-file-version", {
              version: data.version,
            }),
          );
          return;
        }

        const { hyperbook: hyperbookData } = data.data;

        const hyperbookBlob = new Blob([JSON.stringify(hyperbookData)], {
          type: "application/json",
        });

        await db.import(hyperbookBlob, { clearTablesBeforeImport: true });

        // Send full snapshot to cloud after import
        if (hyperbook.cloud) {
          try {
            await hyperbook.cloud.sendSnapshot();
          } catch (e) {
            console.error("Failed to sync import to cloud:", e);
          }
        }

        alert(hyperbook.i18n.get("store-import-sucessful"));
        window.location.reload();
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // Expose the Dexie db instance properties and public API
  return Object.assign(db, {
    db,
    export: hyperbookExport,
    reset: hyperbookReset,
    import: hyperbookImport,
  });
})();
