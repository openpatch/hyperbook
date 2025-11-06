/**
 * @type {import("dexie").Dexie}
 */
var store = new Dexie("Hyperbook");
store.version(1).stores({
  currentState: `
            id,
            path,
            mouseX,
            mouseY,
            scrollX,
            scorllY,
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
});
var sqlIdeDB = new Dexie("SQL-IDE");
sqlIdeDB.version(0.1).stores({
  scripts: `scriptId,script`,
});
var learnJDB = new Dexie("LearnJ");
learnJDB.version(1).stores({
  scripts: `scriptId,script`,
});

const initStore = async () => {
  store.currentState.put({
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
    store.currentState.update(1, { mouseX: e.clientX, mouseY: e.clientY });
  });
  window.addEventListener("scroll", (e) => {
    store.currentState.update(1, {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    });
  });
  window.addEventListener("resize", (e) => {
    store.currentState.update(1, {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    });
  });
};
initStore();

async function hyperbookExport() {
  const hyperbook = await store.export({ prettyJson: true });
  const sqlIde = await sqlIdeDB.export({ prettyJson: true });
  const learnJ = await learnJDB.export({ prettyJson: true });

  const data = {
    version: 1,
    origin: window.location.origin,
    data: {
      hyperbook: JSON.parse(await hyperbook.text()),
      sqlIde: JSON.parse(await sqlIde.text()),
      learnJ: JSON.parse(await learnJ.text()),
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

async function hyperbookReset() {
  async function clearTable(db) {
    for (const table of db.tables) {
      await table.clear();
    }
  }

  // Show custom dialog with two options
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    const dialog = document.createElement("div");
    dialog.style.cssText = `
      background: var(--color-background, white);
      color: var(--color-text, black);
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      text-align: center;
    `;

    const message = document.createElement("p");
    message.textContent = i18n.get("store-reset-page-or-all");
    message.style.cssText = `
      margin-bottom: 20px;
      font-size: 16px;
    `;

    const buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
    `;

    const pageButton = document.createElement("button");
    pageButton.textContent = i18n.get("store-reset-this-page");
    pageButton.style.cssText = `
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      background: var(--color-brand, #007bff);
      color: white;
      cursor: pointer;
      font-size: 14px;
    `;
    pageButton.onmouseover = () => {
      pageButton.style.opacity = "0.9";
    };
    pageButton.onmouseout = () => {
      pageButton.style.opacity = "1";
    };

    const allButton = document.createElement("button");
    allButton.textContent = i18n.get("store-reset-whole-hyperbook");
    allButton.style.cssText = `
      padding: 10px 20px;
      border: none;
      border-radius: 4px;
      background: #dc3545;
      color: white;
      cursor: pointer;
      font-size: 14px;
    `;
    allButton.onmouseover = () => {
      allButton.style.opacity = "0.9";
    };
    allButton.onmouseout = () => {
      allButton.style.opacity = "1";
    };

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.style.cssText = `
      padding: 10px 20px;
      border: 1px solid var(--color-text, #333);
      border-radius: 4px;
      background: transparent;
      color: var(--color-text, black);
      cursor: pointer;
      font-size: 14px;
    `;
    cancelButton.onmouseover = () => {
      cancelButton.style.opacity = "0.7";
    };
    cancelButton.onmouseout = () => {
      cancelButton.style.opacity = "1";
    };

    pageButton.onclick = async () => {
      document.body.removeChild(overlay);
      // Reset only bookmarks for current page
      const currentPath = window.location.pathname;
      const bookmarks = await store.bookmarks.where("path").equals(currentPath).toArray();
      for (const bookmark of bookmarks) {
        await store.bookmarks.delete(bookmark.path);
      }
      alert(i18n.get("store-reset-page-successful"));
      window.location.reload();
      resolve();
    };

    allButton.onclick = async () => {
      document.body.removeChild(overlay);
      // Show additional confirmation for whole hyperbook
      if (!confirm(i18n.get("store-reset-whole-confirm"))) {
        resolve();
        return;
      }
      await clearTable(store);
      await clearTable(learnJDB);
      await clearTable(sqlIdeDB);
      alert(i18n.get("store-reset-sucessful"));
      window.location.reload();
      resolve();
    };

    cancelButton.onclick = () => {
      document.body.removeChild(overlay);
      resolve();
    };

    buttonContainer.appendChild(pageButton);
    buttonContainer.appendChild(allButton);
    buttonContainer.appendChild(cancelButton);

    dialog.appendChild(message);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  });
}

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
          !confirm(i18n.get("store-different-origin", { origin: data.origin }))
        ) {
          return;
        }
      }
      if (data.version !== 1) {
        alert(
          i18n.get("store-not-supported-file-version", {
            version: data.version,
          }),
        );
        return;
      }

      const { hyperbook, sqlIde, learnJ } = data.data;

      const hyperbookBlob = new Blob([JSON.stringify(hyperbook)], {
        type: "application/json",
      });
      const sqlIdeBlob = new Blob([JSON.stringify(sqlIde)], {
        type: "application/json",
      });
      const learnJBlob = new Blob([JSON.stringify(learnJ)], {
        type: "application/json",
      });

      await store.import(hyperbookBlob, { clearTablesBeforeImport: true });
      await sqlIdeDB.import(sqlIdeBlob, { clearTablesBeforeImport: true });
      await learnJDB.import(learnJBlob, { clearTablesBeforeImport: true });

      alert(i18n.get("store-import-sucessful"));
      window.location.reload();
    };
    reader.readAsText(file);
  };
  input.click();
}
