/**
 * @type {import("dexie").Dexie}
 */
var store = new Dexie("Hyperbook");
store.version(2).stores({
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

  const data = {
    version: 1,
    origin: window.location.origin,
    data: {
      hyperbook: JSON.parse(await hyperbook.text()),
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

  // Send empty snapshot to cloud
  if (window.hyperbook && window.hyperbook.cloud) {
    try {
      await window.hyperbook.cloud.sendSnapshot();
    } catch (e) {
      console.error("Failed to sync reset to cloud:", e);
    }
  }

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

      const { hyperbook } = data.data;

      const hyperbookBlob = new Blob([JSON.stringify(hyperbook)], {
        type: "application/json",
      });

      await store.import(hyperbookBlob, { clearTablesBeforeImport: true });

      // Send full snapshot to cloud after import
      if (window.hyperbook && window.hyperbook.cloud) {
        try {
          await window.hyperbook.cloud.sendSnapshot();
        } catch (e) {
          console.error("Failed to sync import to cloud:", e);
        }
      }

      alert(i18n.get("store-import-sucessful"));
      window.location.reload();
    };
    reader.readAsText(file);
  };
  input.click();
}
