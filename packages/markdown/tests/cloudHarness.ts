import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

/**
 * Test harness for assets/cloud.js.
 *
 * cloud.js ships as a plain browser script (no module boundary), so it is
 * evaluated in a vm context with stand-ins for the browser globals it touches:
 * localStorage, fetch, navigator.onLine, window events and the Dexie store.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(here, "..", "assets", "cloud.js"),
  "utf8",
);

export type StubTable = {
  name: string;
  schema: { primKey: { src: string } };
  hook: (type: string, fn: Function) => void;
  put: (row: any) => Promise<void>;
  update: (key: any, mods: any) => Promise<void>;
  delete: (key: any) => Promise<void>;
  rows: Map<string, any>;
};

export type Harness = {
  cloud: any;
  /** The stubbed sync-indicator elements. */
  ui: {
    status: any;
    toggle: any;
    icon: any;
    notice: any;
  };
  sync: any;
  localStorage: Map<string, string>;
  requests: Array<{
    url: string;
    method: string;
    body: any;
    keepalive: boolean;
    headers: Record<string, string>;
  }>;
  reloads: number;
  setOnline: (online: boolean) => void;
  goOnline: () => void;
  /** Dispatch a window event (e.g. "beforeunload", "pagehide"). */
  fire: (type: string, event?: any) => void;
  /** Timers scheduled for >=1s, which the harness defers instead of running. */
  timers: Array<{ delay: number; fn: Function; fired: boolean }>;
  /** Fire every deferred timer scheduled for exactly `delay` ms. */
  runTimers: (delay: number) => number;
  table: (name: string) => StubTable;
  exportOptions: any[];
  imports: any[];
};

/** The real English strings, so tests assert on what a reader actually sees. */
const locales: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(here, "..", "locales", "en.json"), "utf8"),
);

export type HarnessOptions = {
  /** Hyperbook slug; distinguishes the per-book watermark key. */
  hyperbookId?: string;
  /** Pre-seeded localStorage entries. */
  storage?: Record<string, string>;
  /** Whether a valid (non-readonly) auth token is present. */
  authenticated?: boolean;
  /** navigator.onLine at construction time. */
  online?: boolean;
  /** Dexie table names to expose, mapped to their primary-key source string. */
  tables?: Record<string, string>;
  /** Responds to each API call. Return a body, or throw {status, body}. */
  respond?: (req: { url: string; method: string; body: any }) => any;
  /** Omit the user drawer, leaving the toolbar icon as the only indicator. */
  withDrawer?: boolean;
};

/** A JWT-shaped token; only the payload is read, never verified. */
function fakeToken(payload: Record<string, unknown>) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
}

export function readonlyToken() {
  return fakeToken({ id: 1, username: "student1", readonly: true });
}

export async function createHarness(
  options: HarnessOptions = {},
): Promise<Harness> {
  const {
    hyperbookId = "test",
    storage = {},
    authenticated = true,
    online = true,
    tables = { consent: "id", bookmarks: "path", typst: "id" },
    respond = () => ({ lastEventId: 1 }),
    withDrawer = true,
  } = options;

  const store = new Map<string, string>(Object.entries(storage));
  if (authenticated && !store.has("hyperbook_auth_token")) {
    store.set("hyperbook_auth_token", fakeToken({ id: 1, username: "s1" }));
    store.set("hyperbook_auth_user", JSON.stringify({ id: 1, username: "s1" }));
  }

  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };

  const requests: Harness["requests"] = [];
  // Long timers (the retry backoff, the merge reload) would stall a test if it
  // waited them out, so record them and let the test fire them on demand.
  const timers: Array<{ delay: number; fn: Function; fired: boolean }> = [];
  const exportOptions: any[] = [];
  const imports: any[] = [];
  const state = { online, reloads: 0 };
  const windowListeners = new Map<string, Function[]>();

  const stubTables: Record<string, StubTable> = {};
  for (const [name, primKeySrc] of Object.entries(tables)) {
    const rows = new Map<string, any>();
    stubTables[name] = {
      name,
      schema: { primKey: { src: primKeySrc } },
      hook: () => {},
      rows,
      put: async (row: any) => void rows.set(String(row[primKeySrc]), row),
      update: async (key: any, mods: any) => {
        const existing = rows.get(String(key)) ?? {};
        rows.set(String(key), { ...existing, ...mods });
      },
      delete: async (key: any) => void rows.delete(String(key)),
    };
  }

  const db = {
    tables: Object.values(stubTables),
    table: (name: string) => stubTables[name],
    export: async (opts: any) => {
      exportOptions.push(opts);
      const included = Object.keys(stubTables).filter(
        (n) => !opts?.filter || opts.filter(n),
      );
      return {
        text: async () =>
          JSON.stringify({
            formatName: "dexie",
            formatVersion: 1,
            data: {
              databaseName: "Hyperbook",
              databaseVersion: 5,
              tables: included.map((n) => ({
                name: n,
                schema: "id",
                rowCount: 0,
              })),
              data: included.map((n) => ({
                tableName: n,
                inbound: true,
                rows: [],
              })),
            },
          }),
      };
    },
    import: async (blob: any, opts: any) => void imports.push({ blob, opts }),
  };

  const fetchImpl = async (url: string, init: any = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    const req = {
      url,
      method: init.method ?? "GET",
      body,
      keepalive: init.keepalive === true,
      headers: init.headers ?? {},
    };
    requests.push(req);

    let result: any;
    try {
      result = respond(req);
    } catch (thrown: any) {
      return {
        ok: false,
        status: thrown.status ?? 500,
        json: async () => thrown.body ?? { error: "failed" },
      };
    }

    if (result === undefined) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => result };
  };

  const hyperbook: any = {
    store: { db },
    // Mirrors assets/i18n.js: the fallback is used when a key is missing, and
    // {{name}} placeholders are substituted.
    i18n: {
      get: (
        key: string,
        values: Record<string, string> = {},
        fallback?: string,
      ) => {
        let out = locales[key] ?? fallback ?? key;
        for (const [k, v] of Object.entries(values ?? {})) {
          out = out.replace(`{{${k}}}`, v);
        }
        return out;
      },
    },
  };

  const windowStub: any = {
    hyperbook,
    location: {
      hash: "",
      pathname: "/",
      search: "",
      origin: "https://example.org",
      reload: () => void state.reloads++,
    },
    addEventListener: (type: string, fn: Function) => {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type)!.push(fn);
    },
    removeEventListener: () => {},
    close: () => {},
  };

  // Just enough DOM for the sync indicator: the status line in the drawer, the
  // toolbar button that carries its accessible name, and the icon whose
  // data-state drives the badge.
  const makeElement = (id = "", tagName = "div"): any => ({
    id,
    tagName,
    _text: "",
    className: "",
    children: [] as any[],
    parentNode: null as any,
    listeners: {} as Record<string, Function[]>,
    attributes: {} as Record<string, string>,
    style: {},
    classList: { add: () => {}, remove: () => {} },
    closest: () => null,
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    },
    addEventListener(type: string, fn: Function) {
      (this.listeners[type] ||= []).push(fn);
    },
    /** Fire a listener the way a click would. */
    click() {
      (this.listeners.click ?? []).forEach((fn: Function) => fn());
    },
    appendChild(child: any) {
      child.parentNode = this;
      this.children.push(child);
      if (child.id) elements[child.id] = child;
      return child;
    },
    removeChild(child: any) {
      this.children = this.children.filter((c: any) => c !== child);
      child.parentNode = null;
      if (child.id) delete elements[child.id];
      return child;
    },
    // Reading it concatenates the subtree, the way the DOM does; assigning ""
    // is how cloud.js empties a node before rebuilding it.
    get textContent(): string {
      if (this.children.length === 0) return this._text;
      return this.children.map((c: any) => c.textContent).join("");
    },
    set textContent(value: string) {
      this._text = value;
      this.children = [];
    },
  });

  const elements: Record<string, any> = {
    "user-toggle": makeElement("user-toggle"),
    "user-icon": makeElement("user-icon"),
  };
  if (withDrawer) {
    elements["user-save-status"] = makeElement("user-save-status");
  }

  const body: any = makeElement("body", "body");
  body.prepend = (child: any) => body.appendChild(child);

  const documentStub: any = {
    addEventListener: () => {},
    getElementById: (id: string) => elements[id] ?? null,
    querySelector: (selector: string) =>
      selector === ".user-icon" ? elements["user-icon"] : null,
    querySelectorAll: () => [],
    createElement: (tagName: string) => makeElement("", tagName),
    createTextNode: (value: string) => {
      const node = makeElement("", "#text");
      node.textContent = value;
      return node;
    },
    body,
  };

  const context = vm.createContext({
    window: windowStub,
    hyperbook,
    document: documentStub,
    localStorage,
    navigator: {
      get onLine() {
        return state.online;
      },
    },
    history: { replaceState: () => {} },
    fetch: fetchImpl,
    HYPERBOOK_CLOUD: { id: hyperbookId, url: "https://cloud.example.org" },
    console,
    setTimeout: (fn: Function, delay = 0) => {
      if (delay >= 1000) {
        timers.push({ delay, fn, fired: false });
        return -1;
      }
      return setTimeout(fn, delay);
    },
    clearTimeout,
    requestAnimationFrame: (fn: Function) => setTimeout(fn, 0),
    atob: (s: string) => Buffer.from(s, "base64").toString("binary"),
    Blob: class {
      parts: any[];
      constructor(parts: any[]) {
        this.parts = parts;
      }
    },
    confirm: () => true,
    JSON,
    Date,
    Promise,
    Error,
    Math,
    Object,
    Array,
    String,
    Number,
  });

  vm.runInContext(source, context);

  // init() is async: it loads from the cloud, registers the Dexie hooks, and
  // only then stops suppressing events. Poll that flag rather than guessing a
  // delay, or addEvent silently drops the first events a test enqueues.
  const cloud = hyperbook.cloud;
  for (let i = 0; i < 200 && cloud._internal().isLoadingFromCloud; i++) {
    await new Promise((r) => setTimeout(r, 1));
  }

  const internal = cloud._internal();

  return {
    cloud,
    sync: internal.syncManager,
    localStorage: store,
    requests,
    get reloads() {
      return state.reloads;
    },
    /** Flip connectivity and fire the corresponding window event. */
    setOnline: (isOnline: boolean) => {
      state.online = isOnline;
      const handlers =
        windowListeners.get(isOnline ? "online" : "offline") ?? [];
      handlers.forEach((fn) => fn());
    },
    /** Flip connectivity without firing the event, so a drain can be awaited. */
    goOnline: () => {
      state.online = true;
      cloud._internal().syncManager.isOnline = true;
    },
    fire: (type: string, event: any = {}) => {
      const handlers = windowListeners.get(type) ?? [];
      handlers.forEach((fn) => fn(event));
    },
    table: (name: string) => stubTables[name],
    /** Run every recorded long timer scheduled for exactly `delay` ms. */
    runTimers: (delay: number) => {
      const due = timers.filter((t) => t.delay === delay && !t.fired);
      due.forEach((t) => {
        t.fired = true;
        t.fn();
      });
      return due.length;
    },
    timers,
    ui: {
      status: elements["user-save-status"] ?? null,
      toggle: elements["user-toggle"],
      icon: elements["user-icon"],
      /** The ambient notice, or null when nothing is being surfaced. */
      get notice() {
        return elements["cloud-sync-notice"] ?? null;
      },
    },
    exportOptions,
    imports,
  } as Harness;
}

/** An event in the shape the Dexie hooks enqueue. */
export function clientEvent(
  table: string,
  op: string,
  primKey: unknown,
  data: unknown = null,
  schema = "id",
) {
  return { table, schema, op, primKey, data };
}
