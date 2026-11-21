import "fake-indexeddb/auto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import Dexie from "dexie";

/**
 * Test harness for assets/cloud.js.
 *
 * cloud.js ships as a plain browser script (no module boundary), so it is
 * evaluated in a vm context with stand-ins for the browser globals it touches.
 * The store is real Dexie on fake-indexeddb, so hooks and transactions behave
 * as in a browser. A `FakeCloud` speaks the server's store protocol in memory,
 * so several devices can share one student's saved state.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "..", "assets", "cloud.js"), "utf8");
const locales: Record<string, string> = JSON.parse(
  fs.readFileSync(path.join(here, "..", "locales", "en.json"), "utf8"),
);

type Row = { table: string; key: unknown; data: Record<string, unknown> | null };
type Upload = Row & { at?: number; base?: number };
type Stored = Row & { revision: number; editedAt: number };

export type Request = {
  url: string;
  method: string;
  body: any;
  keepalive: boolean;
  headers: Record<string, string>;
  /** Bytes on the wire, after any compression. */
  size: number;
};

/** The server side of one student's saved state, as platforms/cloud keeps it. */
export class FakeCloud {
  revision = 0;
  rows = new Map<string, Stored>();
  requests: Request[] = [];
  /** Answer the next requests to /store with these statuses (0: network error). */
  failures: number[] = [];
  /** Refuse (413) every upload holding a row this picks out, as for a row too large. */
  refuse: ((row: Row) => boolean) | null = null;
  /** The platform's limit of rows per request. */
  maxRows = 1000;
  /** Runs as an answer to /store leaves the server, to race it with a change. */
  onAnswer: (() => void) | null = null;
  /** Hold requests until released, to test changes made meanwhile. */
  held: Array<() => void> | null = null;
  username = "ada";
  readonly = false;
  loggedIn = true;

  hold() {
    this.held = [];
  }

  release() {
    const held = this.held ?? [];
    this.held = null;
    held.forEach((go) => go());
  }

  /** What the server has: live rows by table, keyed by JSON key. */
  saved(table: string) {
    const out: Record<string, unknown> = {};
    for (const r of this.rows.values()) {
      if (r.table === table && r.data !== null) out[JSON.stringify(r.key)] = r.data;
    }
    return out;
  }

  /** Another device uploads rows, changed at `at`. */
  upload(rows: Row[], at = Date.now()) {
    this.revision += 1;
    for (const r of rows) {
      this.rows.set(`${r.table}\0${JSON.stringify(r.key)}`, { ...r, revision: this.revision, editedAt: at });
    }
  }

  changes(since: number) {
    return [...this.rows.values()]
      .filter((r) => (since === 0 ? r.data !== null : r.revision > since))
      .map(({ table, key, data }) => ({ table, key, data }));
  }

  async handle(req: Request): Promise<{ status: number; body: any }> {
    const answer = await this.answer(req);
    if (this.onAnswer && answer.status === 200 && /\/store(\?|$)/.test(req.url)) this.onAnswer();
    return answer;
  }

  private async answer(req: Request): Promise<{ status: number; body: any }> {
    this.requests.push(req);
    if (this.held) await new Promise<void>((go) => this.held!.push(go));
    const route = new URL(req.url, "https://x").pathname.replace(/^.*\/_hyperbook\/api/, "");
    if (route === "/session") {
      return this.loggedIn
        ? { status: 200, body: { user: { username: this.username }, readonly: this.readonly } }
        : { status: 401, body: { error: "Not logged in" } };
    }
    if (route === "/logout") return { status: 200, body: { ok: true } };
    if (route === "/login" || route === "/login/key") {
      this.loggedIn = true;
      return { status: 200, body: { user: { username: this.username }, token: "token-new" } };
    }
    if (route !== "/store") return { status: 404, body: { error: "Not found" } };

    const failure = this.failures.shift();
    if (failure !== undefined) {
      if (failure === 0) throw new TypeError("Failed to fetch");
      return { status: failure, body: { error: "failed" } };
    }
    if (!this.loggedIn) return { status: 401, body: { error: "Not logged in" } };

    if (req.method === "GET") {
      const since = Number(new URL(req.url, "https://x").searchParams.get("since") ?? 0);
      return { status: 200, body: { revision: this.revision, rows: since >= this.revision ? [] : this.changes(since) } };
    }
    if (this.readonly) return { status: 403, body: { error: "read-only" } };
    const { since, rows, replace } = req.body as { since: number; rows: Upload[]; replace?: boolean };
    if (rows.length > this.maxRows) return { status: 400, body: { error: "Too many rows" } };
    if (this.refuse && rows.some((r) => this.refuse!(r))) return { status: 413, body: { error: "Too large" } };
    if (rows.length === 0 && !replace) {
      return { status: 200, body: { revision: this.revision, rows: since >= this.revision ? [] : this.changes(since) } };
    }
    // As platforms/cloud: a change loses to a later one the device never saw.
    const now = Date.now();
    const id = (r: Row) => `${r.table}\0${JSON.stringify(r.key)}`;
    const lost = new Map<string, Row>();
    const write: Array<[string, Row, number]> = [];
    for (const r of rows) {
      const at = Math.min(r.at ?? now, now);
      const old = this.rows.get(id(r));
      if (old && !replace && r.base !== undefined && old.revision > r.base && at < old.editedAt) {
        lost.set(id(r), { table: old.table, key: old.key, data: old.data });
      } else {
        write.push([id(r), { table: r.table, key: r.key, data: r.data }, at]);
      }
    }
    if (write.length === 0 && !replace) {
      const changes = since >= this.revision ? [] : this.changes(since);
      return { status: 200, body: { revision: this.revision, rows: [...changes.filter((r) => !lost.has(id(r))), ...lost.values()] } };
    }
    const before = this.revision;
    this.revision += 1;
    const named = new Set<string>();
    for (const [key, row, at] of write) {
      named.add(key);
      this.rows.set(key, { ...row, revision: this.revision, editedAt: at });
    }
    if (replace) {
      for (const [key, r] of this.rows) {
        if (!named.has(key) && r.data !== null) this.rows.set(key, { ...r, data: null, revision: this.revision, editedAt: now });
      }
    }
    const others =
      since >= before
        ? []
        : [...this.rows.values()]
            .filter((r) => r.revision > since && r.revision !== this.revision && (since > 0 || r.data !== null))
            .map(({ table, key, data }) => ({ table, key, data }));
    return {
      status: 200,
      body: { revision: this.revision, rows: [...others.filter((r) => !lost.has(id(r))), ...lost.values()] },
    };
  }
}

export type DeviceOptions = {
  /** Leave CompressionStream out, as an older browser would. */
  noCompression?: boolean;
  cloud: FakeCloud;
  /** Share a device between page loads: same IndexedDB and localStorage. */
  name?: string;
  storage?: Map<string, string>;
  sameOrigin?: boolean;
  online?: boolean;
  hash?: string;
  /** Whether the device believes it is logged in (cached session). */
  loggedIn?: boolean;
};

let deviceCount = 0;

/**
 * navigator.locks for one device: its tabs share the localStorage map, and
 * a lock admits one holder at a time, in order of request.
 */
const lockManagers = new WeakMap<Map<string, string>, { request: Function }>();
function locksOf(storage: Map<string, string>) {
  let manager = lockManagers.get(storage);
  if (!manager) {
    const tails = new Map<string, Promise<unknown>>();
    manager = {
      request(name: string, fn: () => Promise<unknown>) {
        const run = (tails.get(name) ?? Promise.resolve()).then(() => fn());
        tails.set(
          name,
          run.catch(() => {}),
        );
        return run;
      },
    };
    lockManagers.set(storage, manager);
  }
  return manager;
}

/** One page load of a book on one device. */
export async function openPage(options: DeviceOptions) {
  const {
    cloud,
    name = `device-${++deviceCount}`,
    storage = new Map<string, string>(),
    sameOrigin = true,
    online = true,
    hash = "",
    loggedIn = true,
    noCompression = false,
  } = options;

  const bookKey = sameOrigin ? "cloud" : "physics";
  if (loggedIn && !storage.has(`hyperbook_auth_user:${bookKey}`)) {
    storage.set(`hyperbook_auth_user:${bookKey}`, JSON.stringify({ username: cloud.username, readonly: cloud.readonly }));
    if (!sameOrigin) storage.set(`hyperbook_auth_token:${bookKey}`, "token-1");
  }

  const db = new Dexie(name);
  db.version(1).stores({
    currentState: "id",
    bookmarks: "path",
    textinput: "id",
    pairs: "[a+b]",
  });
  await db.open();

  const localStorage = {
    getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
    setItem: (k: string, v: string) => void storage.set(k, String(v)),
    removeItem: (k: string) => void storage.delete(k),
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() {
      return storage.size;
    },
  };

  const state = { online, reloads: 0, confirms: [] as string[], answers: [] as boolean[] };
  const windowListeners = new Map<string, Function[]>();
  const docListeners = new Map<string, Function[]>();

  // Timers run only when a test advances the clock, so debounces are explicit.
  let now = 0;
  const timers: Array<{ at: number; fn: Function; id: number }> = [];
  let nextTimer = 1;
  const setTimeoutStub = (fn: Function, delay = 0) => {
    const id = nextTimer++;
    timers.push({ at: now + delay, fn, id });
    return id;
  };
  const clearTimeoutStub = (id: number) => {
    const i = timers.findIndex((t) => t.id === id);
    if (i >= 0) timers.splice(i, 1);
  };

  const fetchImpl = async (url: string, init: any = {}) => {
    if (!state.online) throw new TypeError("Failed to fetch");
    const headers = init.headers ?? {};
    let raw: string | undefined;
    let size = 0;
    if (typeof init.body === "string") {
      raw = init.body;
      size = Buffer.byteLength(init.body);
    } else if (init.body) {
      // The server only unpacks what is announced as gzip.
      const bytes = Buffer.from(init.body as ArrayBuffer);
      size = bytes.length;
      raw = headers["Content-Encoding"] === "gzip" ? gunzipSync(bytes).toString("utf8") : bytes.toString("utf8");
    }
    const req: Request = {
      url,
      method: init.method ?? "GET",
      body: raw ? JSON.parse(raw) : null,
      keepalive: init.keepalive === true,
      headers,
      size,
    };
    const res = await cloud.handle(req);
    return { ok: res.status >= 200 && res.status < 300, status: res.status, json: async () => res.body };
  };

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
    setAttribute(n: string, v: string) {
      this.attributes[n] = v;
    },
    getAttribute(n: string) {
      return this.attributes[n] ?? null;
    },
    hasAttribute(n: string) {
      return n in this.attributes;
    },
    addEventListener(type: string, fn: Function) {
      (this.listeners[type] ||= []).push(fn);
    },
    click() {
      (this.listeners.click ?? []).forEach((fn: Function) => fn({ preventDefault() {} }));
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
    "user-save-status": makeElement("user-save-status"),
  };
  const body: any = makeElement("body", "body");
  body.prepend = (child: any) => body.appendChild(child);

  const hyperbook: any = {
    store: { db },
    i18n: {
      get: (key: string, values: Record<string, string> = {}, fallback?: string) => {
        let out = locales[key] ?? fallback ?? key;
        for (const [k, v] of Object.entries(values ?? {})) out = out.replace(`{{${k}}}`, v);
        return out;
      },
    },
  };

  const context = vm.createContext({
    window: {
      hyperbook,
      location: {
        hash,
        pathname: "/",
        search: "",
        origin: "https://example.org",
        reload: () => void state.reloads++,
      },
      addEventListener: (type: string, fn: Function) => {
        if (!windowListeners.has(type)) windowListeners.set(type, []);
        windowListeners.get(type)!.push(fn);
      },
      close: () => {},
    },
    hyperbook,
    document: {
      hidden: false,
      addEventListener: (type: string, fn: Function) => {
        if (!docListeners.has(type)) docListeners.set(type, []);
        docListeners.get(type)!.push(fn);
      },
      getElementById: (id: string) => elements[id] ?? null,
      querySelector: (sel: string) => (sel === ".user-icon" ? elements["user-icon"] : null),
      querySelectorAll: () => [],
      createElement: (tag: string) => makeElement("", tag),
      createTextNode: (value: string) => {
        const node = makeElement("", "#text");
        node.textContent = value;
        return node;
      },
      body,
    },
    localStorage,
    navigator: {
      get onLine() {
        return state.online;
      },
      locks: locksOf(storage),
    },
    history: { replaceState: () => {} },
    fetch: fetchImpl,
    HYPERBOOK_CLOUD: sameOrigin ? { sameOrigin: true } : { id: "physics", url: "https://physics.books.example.org" },
    console: { log() {}, warn() {}, error() {} },
    setTimeout: setTimeoutStub,
    clearTimeout: clearTimeoutStub,
    confirm: (message: string) => {
      state.confirms.push(message);
      return state.answers.length > 0 ? state.answers.shift()! : true;
    },
    JSON,
    Date,
    Promise,
    Error,
    Math,
    Object,
    Array,
    String,
    Number,
    Map,
    WeakSet,
    TypeError,
    Blob,
    Response,
    ...(noCompression ? {} : { CompressionStream }),
  });

  vm.runInContext(source, context);
  const api = hyperbook.cloud;

  /** Lets every pending promise and IndexedDB request settle. */
  const settle = async () => {
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
  };

  const page = {
    db,
    api,
    cloud,
    name,
    storage,
    elements,
    get reloads() {
      return state.reloads;
    },
    get confirms() {
      return state.confirms;
    },
    /** Answers for the next confirm() dialogs, in order; then "OK". */
    answer(...answers: boolean[]) {
      state.answers.push(...answers);
    },
    internal: () => api._internal(),
    settle,
    /** Advances the clock, firing due timers in order. */
    async tick(ms: number) {
      const until = now + ms;
      for (;;) {
        await settle();
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > until) break;
        timers.shift();
        now = next.at;
        next.fn();
      }
      now = until;
      await settle();
    },
    /** Waits for the start-up sync. */
    async ready() {
      await api._internal().ready;
      await settle();
    },
    setOnline(online: boolean) {
      state.online = online;
      (windowListeners.get(online ? "online" : "offline") ?? []).forEach((fn) => fn());
    },
    fire(type: string, event: any = {}) {
      (windowListeners.get(type) ?? []).forEach((fn) => fn(event));
    },
    hide() {
      context.document.hidden = true;
      (docListeners.get("visibilitychange") ?? []).forEach((fn) => fn());
    },
    get status() {
      return elements["user-save-status"].className;
    },
    get notice() {
      return elements["cloud-sync-notice"] ?? null;
    },
    /**
     * What the sync state in localStorage says, with the marks by
     * "<table>\0<key as JSON>"; null without one.
     */
    get sync(): any {
      const prefix = `hyperbook_sync:${bookKey}:`;
      const student = storage.get(`${prefix}student`);
      if (student === undefined) return null;
      const dirty: Record<string, any> = {};
      for (const [k, v] of storage) {
        if (!k.startsWith(`${prefix}dirty:`)) continue;
        const [table, key] = JSON.parse(k.slice(`${prefix}dirty:`.length));
        dirty[`${table}\0${JSON.stringify(key)}`] = JSON.parse(v);
      }
      return {
        student,
        revision: Number(storage.get(`${prefix}revision`) ?? 0),
        replace: storage.get(`${prefix}replace`) === "1",
        dirty,
      };
    },
    /** Another tab of this book on this device, open at the same time. */
    async openTab() {
      const tab = await openPage({ cloud, name, storage, sameOrigin, noCompression });
      await tab.ready();
      return tab;
    },
    /** The next page load on this device. */
    async reopen(extra: Partial<DeviceOptions> = {}) {
      db.close();
      const next = await openPage({ cloud, name, storage, sameOrigin, noCompression, ...extra });
      await next.ready();
      return next;
    },
  };
  return page;
}

export type Page = Awaited<ReturnType<typeof openPage>>;

/** A page that has finished its start-up sync. */
export async function readyPage(options: DeviceOptions) {
  const page = await openPage(options);
  await page.ready();
  return page;
}
