const { createStorageBackend } = require("./browserEnv.js");

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Dexie = require("dexie");
require("dexie-export-import");

/**
 * A browser session for the e2e test.
 *
 * Runs the shipped `assets/store.js` and `assets/cloud.js` verbatim in a vm
 * context, on a real Dexie/IndexedDB database, talking to a real cloud server
 * over real HTTP. Nothing hyperbook owns is stubbed: the Dexie schema, the
 * change hooks, the export/import round trip, the event batching and the
 * server's event sourcing are all the production code paths. Only platform
 * APIs the browser would provide (localStorage, window, navigator) stand in.
 */

const ASSETS = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "packages",
  "markdown",
  "assets",
);

const storeSource = fs.readFileSync(path.join(ASSETS, "store.js"), "utf8");
const cloudSource = fs.readFileSync(path.join(ASSETS, "cloud.js"), "utf8");

/**
 * Each session needs its own IndexedDB. Renaming the database is not an
 * option — dexie-export-import refuses an import whose databaseName differs —
 * so give each one a private storage backend under the same name instead.
 */
function isolatedDexie(backend) {
  return class IsolatedDexie extends Dexie {
    constructor(name, options) {
      super(name, {
        indexedDB: backend.indexedDB,
        IDBKeyRange: backend.IDBKeyRange,
        ...options,
      });
    }
  };
}

let sessionCounter = 0;

/** Sessions opened with the same key share storage, i.e. are the same browser. */
const backends = new Map();

function backendFor(key) {
  if (!backends.has(key)) backends.set(key, createStorageBackend());
  return backends.get(key);
}

/**
 * @param {object} options
 * @param {string} options.baseUrl   Address of the running cloud server.
 * @param {string} options.token     JWT issued by the server's auth module.
 * @param {string} [options.hyperbookId]  Slug, must exist server-side.
 * @param {string} [options.dbSuffix]     Share one to reuse the same storage.
 * @param {boolean} [options.online]
 */
async function createBrowser(options) {
  const {
    baseUrl,
    token,
    hyperbookId = "test",
    dbSuffix = `s${++sessionCounter}`,
    online = true,
  } = options;

  const store = new Map();
  store.set("hyperbook_auth_token", token);
  store.set(
    "hyperbook_auth_user",
    JSON.stringify({ id: 1, username: "student1" }),
  );
  for (const [key, value] of Object.entries(options.storage || {})) {
    store.set(key, String(value));
  }

  const state = { online, reloads: 0 };
  const listeners = new Map();
  const requests = [];
  const errors = [];

  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };

  // Real fetch, but recorded, and refused while the session is "offline" the
  // way a browser refuses it.
  const trackedFetch = async (url, init = {}) => {
    requests.push({
      url: String(url),
      method: init.method || "GET",
      body: init.body ? JSON.parse(init.body) : null,
    });
    if (!state.online) throw new TypeError("Failed to fetch");
    return fetch(url, init);
  };

  const hyperbook = {
    i18n: { get: (_key, _vars, fallback) => fallback || "" },
  };

  const windowStub = {
    hyperbook,
    location: {
      hash: "",
      pathname: "/",
      search: "",
      origin: "https://example.org",
      reload: () => void state.reloads++,
    },
    scrollX: 0,
    scrollY: 0,
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener: () => {},
    close: () => {},
  };

  // Enough DOM for the sync indicator and the ambient notice to build
  // themselves; the e2e assertions read them back through `session.ui`.
  const elements = {};
  const makeElement = (tagName = "div") => ({
    tagName,
    id: "",
    _text: "",
    className: "",
    children: [],
    parentNode: null,
    listeners: {},
    attributes: {},
    style: {},
    classList: { add: () => {}, remove: () => {} },
    closest: () => null,
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getAttribute(name) {
      return this.attributes[name] ?? null;
    },
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    click() {
      (this.listeners.click || []).forEach((fn) => fn());
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      if (child.id) elements[child.id] = child;
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((c) => c !== child);
      child.parentNode = null;
      if (child.id) delete elements[child.id];
      return child;
    },
    get textContent() {
      if (this.children.length === 0) return this._text;
      return this.children.map((c) => c.textContent).join("");
    },
    set textContent(value) {
      this._text = value;
      this.children = [];
    },
  });

  const body = makeElement("body");
  body.prepend = (child) => body.appendChild(child);

  const documentStub = {
    addEventListener: () => {},
    getElementById: (id) => elements[id] ?? null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: (tagName) => makeElement(tagName),
    createTextNode: (value) => {
      const node = makeElement("#text");
      node.textContent = value;
      return node;
    },
    body,
    hidden: false,
  };

  const context = vm.createContext({
    window: windowStub,
    hyperbook,
    document: documentStub,
    localStorage,
    Dexie: isolatedDexie(backendFor(dbSuffix)),
    navigator: {
      get onLine() {
        return state.online;
      },
    },
    history: { replaceState: () => {} },
    fetch: trackedFetch,
    HYPERBOOK_CLOUD: { id: hyperbookId, url: baseUrl },
    // Quiet by default, but keep the errors so a test can assert the client
    // hit no exception it swallowed into a catch.
    console: options.verbose
      ? console
      : {
          log: () => {},
          warn: () => {},
          error: (...args) => errors.push(args.map(String).join(" ")),
        },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    confirm: () => true,
    alert: () => {},
    URL,
    // Share the host realm's intrinsics: Dexie and IndexedDB live outside the
    // vm, and cross-realm objects break their instanceof checks.
    Blob,
    FileReader: globalThis.FileReader,
    JSON,
    Date,
    Promise,
    Error,
    TypeError,
    Math,
    Object,
    Array,
    String,
    Number,
    Boolean,
    Symbol,
    Uint8Array,
    ArrayBuffer,
  });

  vm.runInContext(storeSource, context, { filename: "store.js" });
  vm.runInContext(cloudSource, context, { filename: "cloud.js" });

  const cloud = hyperbook.cloud;

  // init() loads from the cloud, registers the Dexie hooks and only then stops
  // suppressing events. Poll that rather than guessing a delay.
  for (let i = 0; i < 500 && cloud._internal().isLoadingFromCloud; i++) {
    await new Promise((r) => setTimeout(r, 2));
  }

  const sync = cloud._internal().syncManager;
  if (sync) {
    // Save on demand instead of on a 2s debounce.
    sync.minSaveInterval = 0;
    sync.debounceDelay = 5;
  }

  return {
    cloud,
    sync,
    db: hyperbook.store.db,
    store: hyperbook.store,
    localStorage: store,
    requests,
    /** Anything the client logged with console.error. */
    errors,
    ui: {
      /** The ambient sync notice, or null when nothing is being surfaced. */
      get notice() {
        return elements["cloud-sync-notice"] ?? null;
      },
    },
    get reloads() {
      return state.reloads;
    },
    /** Wait for the debounced save to land. */
    async settle() {
      await new Promise((r) => setTimeout(r, 30));
      if (sync && sync.isDirty) await sync.performSave("test");
      await new Promise((r) => setTimeout(r, 10));
    },
    setOnline(isOnline) {
      state.online = isOnline;
      if (sync) sync.isOnline = isOnline;
    },
    fire(type, event = {}) {
      (listeners.get(type) || []).forEach((fn) => fn(event));
    },
    async close() {
      hyperbook.store.db.close();
    },
  };
}

module.exports = { createBrowser };
