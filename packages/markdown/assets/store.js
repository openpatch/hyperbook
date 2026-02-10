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
  multievent: `id,state`,
  typst: `id,code`,
});

/**
 * Read all data from an external IndexedDB database using the raw API.
 * Returns a Dexie-export-compatible object, or null if the DB doesn't exist.
 */
function exportExternalDB(dbName) {
  return new Promise((resolve) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => resolve(null);
    request.onsuccess = (event) => {
      const db = event.target.result;
      const storeNames = Array.from(db.objectStoreNames);
      if (storeNames.length === 0) {
        db.close();
        resolve(null);
        return;
      }
      const result = {
        formatName: "dexie",
        formatVersion: 1,
        data: {
          databaseName: dbName,
          databaseVersion: db.version,
          tables: [],
        },
      };
      const tx = db.transaction(storeNames, "readonly");
      let pending = storeNames.length;
      storeNames.forEach((name) => {
        const objectStore = tx.objectStore(name);
        const tableInfo = {
          name: name,
          schema: objectStore.keyPath ? `${objectStore.keyPath}` : "++id",
          rowCount: 0,
          rows: [],
        };
        const cursorReq = objectStore.openCursor();
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            tableInfo.rows.push(cursor.value);
            cursor.continue();
          } else {
            tableInfo.rowCount = tableInfo.rows.length;
            result.data.tables.push(tableInfo);
            pending--;
            if (pending === 0) {
              db.close();
              resolve(result);
            }
          }
        };
        cursorReq.onerror = () => {
          pending--;
          if (pending === 0) {
            db.close();
            resolve(result);
          }
        };
      });
    };
  });
}

/**
 * Import data into an external IndexedDB database using the raw API.
 * Accepts a Dexie-export-compatible object. Clears existing data before importing.
 */
function importExternalDB(dbName, exportData) {
  return new Promise((resolve, reject) => {
    const tables = exportData?.data?.tables;
    if (!tables || tables.length === 0) { resolve(); return; }

    // Determine the version the external tool uses (keep it in sync)
    const request = indexedDB.open(dbName);
    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      // DB didn't exist yet — create the object stores from the export data
      const db = event.target.result;
      tables.forEach((table) => {
        if (!db.objectStoreNames.contains(table.name)) {
          const keyPath = table.schema && !table.schema.startsWith('++')
            ? table.schema.split(',')[0].trim()
            : null;
          db.createObjectStore(table.name, keyPath ? { keyPath } : { autoIncrement: true });
        }
      });
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const storeNames = tables
        .map((t) => t.name)
        .filter((n) => db.objectStoreNames.contains(n));
      if (storeNames.length === 0) { db.close(); resolve(); return; }

      const tx = db.transaction(storeNames, "readwrite");
      // Clear then re-populate each store
      storeNames.forEach((name) => {
        const objectStore = tx.objectStore(name);
        objectStore.clear();
        const table = tables.find((t) => t.name === name);
        if (table && table.rows) {
          table.rows.forEach((row) => objectStore.put(row));
        }
      });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

/**
 * Clear all tables in an external IndexedDB database using the raw API.
 */
function clearExternalDB(dbName) {
  return new Promise((resolve) => {
    const request = indexedDB.open(dbName);
    request.onerror = () => resolve();
    request.onsuccess = (event) => {
      const db = event.target.result;
      const storeNames = Array.from(db.objectStoreNames);
      if (storeNames.length === 0) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction(storeNames, "readwrite");
      storeNames.forEach((name) => tx.objectStore(name).clear());
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); resolve(); };
    };
  });
}

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
  const sqlIde = await exportExternalDB('SQL-IDE');
  const learnJ = await exportExternalDB('LearnJ');

  const data = {
    version: 1,
    origin: window.location.origin,
    data: {
      hyperbook: JSON.parse(await hyperbook.text()),
      sqlIde: sqlIde || {},
      learnJ: learnJ || {},
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
  await clearExternalDB('LearnJ');
  await clearExternalDB('SQL-IDE');

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

      await store.import(hyperbookBlob, { clearTablesBeforeImport: true });
      if (sqlIde) {
        await importExternalDB('SQL-IDE', sqlIde);
      }
      if (learnJ) {
        await importExternalDB('LearnJ', learnJ);
      }

      alert(i18n.get("store-import-sucessful"));
      window.location.reload();
    };
    reader.readAsText(file);
  };
  input.click();
}
