/**
 * Minimal browser globals so a real Dexie database can run under Node.
 *
 * The e2e test drives the actual client asset against the actual server, which
 * means IndexedDB and the Blob-reading APIs `dexie-export-import` relies on have
 * to exist. Everything here is a stand-in for a platform API, never for
 * hyperbook code — the point of the test is that no hyperbook code is faked.
 */

// dexie-export-import probes `self` for FileReaderSync at module scope.
if (typeof globalThis.self === "undefined") globalThis.self = globalThis;

require("fake-indexeddb/auto");

// Node has Blob but not FileReader. dexie-export-import reads the import blob
// through one, expecting the result on `ev.target.result`.
if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class FileReader {
    constructor() {
      this.result = null;
      this.error = null;
      this.onload = null;
      this.onerror = null;
      this.onabort = null;
    }

    _read(promise) {
      promise.then(
        (result) => {
          this.result = result;
          if (this.onload) this.onload({ target: this });
        },
        (error) => {
          this.error = error;
          if (this.onerror) this.onerror({ target: this });
        },
      );
    }

    readAsText(blob) {
      this._read(blob.text());
    }

    readAsArrayBuffer(blob) {
      this._read(blob.arrayBuffer());
    }
  };
}

const { IDBFactory } = require("fake-indexeddb");
const IDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange");

/** A private IndexedDB, so two sessions in one test do not share storage. */
function createStorageBackend() {
  return { indexedDB: new IDBFactory(), IDBKeyRange };
}

module.exports = { createStorageBackend };
