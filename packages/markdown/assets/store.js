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

  if (!confirm(i18n.get("store-reset-confirm"))) {
    return;
  }

  clearTable(store);
  clearTable(learnJDB);
  clearTable(sqlIdeDB);

  alert(i18n.get("store-reset-sucessful"));
  window.location.reload();
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
