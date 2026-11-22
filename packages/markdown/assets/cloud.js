/// <reference path="./hyperbook.types.js" />
window.hyperbook = window.hyperbook || {};

/**
 * Saves a logged-in student's store to Hyperbook Cloud and brings it to their
 * other devices.
 *
 * Two modes, set by the `cloud` entry of hyperbook.json:
 *  - `{ sameOrigin: true }`: the book is hosted by Hyperbook Cloud, which sets
 *    this when it builds the book. The API is on the book's own host and the
 *    session is an HttpOnly cookie the script never sees.
 *  - `{ url, id }`: the book is hosted elsewhere and talks to its address on
 *    Hyperbook Cloud cross-origin, with a Bearer token in localStorage.
 *
 * How sync works:
 *  - The local store (Dexie) is the truth. Every write an element makes marks
 *    its row as "not uploaded yet" in localStorage, synchronously, so the mark
 *    survives leaving the page, closing the tab and going offline. Each mark
 *    is its own localStorage entry, so tabs never overwrite each other's.
 *  - An upload reads the current value of each marked row (null if it was
 *    deleted) and sends it. The server keeps one value per row; sending a row
 *    twice is harmless, so there is nothing to warn about when leaving a page.
 *    The mark is removed only once the server has the row, and only if the
 *    row did not change again in the meantime. Uploads go in batches; a row
 *    the server refuses is set aside so it does not hold up the rest.
 *  - Another device may have saved the same row since this one last looked
 *    (a school computer that kept a change for a week). The server keeps the
 *    change made later and hands it back to the device whose change lost.
 *  - Each upload advances the student's revision. A device remembers the
 *    revision it has seen and downloads only what other devices uploaded after
 *    it — never over a row it has not uploaded yet. Tabs take turns syncing.
 *  - The first time a student syncs on a device (or another student logs in on
 *    it) the local store is replaced by the saved state.
 * @type {HyperbookCloud}
 * @memberof hyperbook
 * @see hyperbook.store
 * @see hyperbook.i18n
 */
hyperbook.cloud = (function () {
  const AUTH_TOKEN_KEY = "hyperbook_auth_token";
  const AUTH_USER_KEY = "hyperbook_auth_user";
  const SYNC_KEY = "hyperbook_sync";
  const SAME_ORIGIN = !!(HYPERBOOK_CLOUD && HYPERBOOK_CLOUD.sameOrigin);
  const API_BASE = !HYPERBOOK_CLOUD
    ? ""
    : (SAME_ORIGIN ? "" : String(HYPERBOOK_CLOUD.url || "").replace(/\/+$/, "")) +
      "/_hyperbook/api";
  // Tables holding ephemeral UI state (cursor, scroll) that must never sync.
  const EPHEMERAL_TABLES = ["currentState"];
  // An upload waits for a pause in typing, but not forever.
  const PUSH_DELAY = 1000;
  const PUSH_MAX_WAIT = 5000;
  const RETRY_MAX = 30000;
  // Uploads from this size on are gzip-compressed. Element state is JSON or
  // base64 and typically shrinks 3–10 times; below this the saving is not
  // worth the work.
  const COMPRESS_MIN_SIZE = 8 * 1024;
  // Browsers refuse keepalive requests over 64 KB in flight.
  const KEEPALIVE_MAX_SIZE = 60 * 1024;
  // Uploads go in batches, so a backlog never becomes one request the server
  // refuses or that holds it up for long.
  const BATCH_MAX_ROWS = 500;
  const BATCH_MAX_SIZE = 1024 * 1024;
  // A request that hangs must not hold up every later upload.
  const REQUEST_TIMEOUT = 30000;

  /**
   * Names this book's entries in localStorage. A hosted book is alone on its
   * origin; books hosted elsewhere may share one (several books on one
   * GitHub Pages site), so theirs carry the id.
   */
  function bookKey() {
    return SAME_ORIGIN ? "cloud" : HYPERBOOK_CLOUD.id;
  }

  // ===== Persisted sync state =====

  /*
   * Kept in localStorage under `hyperbook_sync:<book>:`, one entry per fact.
   * Each entry is written whole and never merged, so tabs of the book cannot
   * overwrite each other's marks:
   *  - `student`: whose state the local store holds ("view:" prefix for a
   *    teacher's read-only view), so another login starts from scratch;
   *  - `revision`: the server revision whose rows the local store holds;
   *  - `replace`: "1" while the whole store must be uploaded (after an import
   *    or reset);
   *  - `dirty:<[table, key] as JSON>`: a row changed but not uploaded yet, as
   *    `{ at, base, n, refused? }` — when it last changed; the revision the
   *    device had seen when it first changed (with `at`, the server settles
   *    a change another device made meanwhile); a nonce telling two changes
   *    apart; and whether the server refused the row, which then waits until
   *    it changes again or the reader retries.
   */
  const DIRTY = "dirty:";

  function prefix() {
    return `${SYNC_KEY}:${bookKey()}:`;
  }
  const read = (name) => localStorage.getItem(prefix() + name);
  const write = (name, value) => localStorage.setItem(prefix() + name, value);
  const erase = (name) => localStorage.removeItem(prefix() + name);

  /** The localStorage keys starting with `start`. */
  function keysFrom(start) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(start)) keys.push(key);
    }
    return keys;
  }

  const syncedStudent = () => read("student");
  /**
   * Makes every mark's text unique. unmark() removes a mark only while its
   * text is still the one uploaded; without the nonce, a second change in
   * the same millisecond (same `at` and `base`) would look like the uploaded
   * one and lose its mark, so it would never reach the server.
   */
  const nonce = () => Math.random().toString(36).slice(2, 10);
  /** A revision from the server, or null when the answer has none. */
  const validRevision = (revision) => (Number.isSafeInteger(revision) && revision >= 0 ? revision : null);
  /** Stores the server's revision; a malformed answer keeps the one there. */
  function writeRevision(revision) {
    const valid = validRevision(revision);
    if (valid !== null) write("revision", String(valid));
  }
  function syncedRevision() {
    const revision = Number(read("revision"));
    return Number.isSafeInteger(revision) && revision > 0 ? revision : 0;
  }
  const replacePending = () => read("replace") === "1";

  const markName = (table, key) => DIRTY + JSON.stringify([table, key]);
  const isMarked = (table, key) => read(markName(table, key)) !== null;

  /** Every marked row: `{ name, table, key, raw, mark }`. */
  function readMarks() {
    const start = prefix() + DIRTY;
    const marks = [];
    for (const storageKey of keysFrom(start)) {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) continue;
      try {
        const [table, key] = JSON.parse(storageKey.slice(start.length));
        marks.push({ name: storageKey.slice(prefix().length), table, key, raw, mark: JSON.parse(raw) });
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
    return marks;
  }
  const pendingMarks = () => readMarks().filter((m) => !m.mark.refused);
  /** Something is waiting to be uploaded. */
  const isDirty = () => replacePending() || pendingMarks().length > 0;
  /** Something is not on the server, counting rows it refused. */
  const hasUnsent = () => replacePending() || readMarks().length > 0;
  const hasRefused = () => readMarks().some((m) => m.mark.refused);

  /** Removes a mark, unless the row changed again since it was read. */
  function unmark(m) {
    if (read(m.name) === m.raw) {
      erase(m.name);
      latest.delete(m.name);
    }
  }

  /** Forgets the sync state of this book on this device. */
  function clearSyncState() {
    keysFrom(prefix()).forEach((key) => localStorage.removeItem(key));
    latest.clear();
  }

  // ===== Local store access =====

  /** Transactions the sync itself opened; their writes are not changes. */
  const ownTransactions = new WeakSet();
  // Latest value of each row this page marked, by mark name, for the upload
  // on page hide, which cannot wait for an IndexedDB read.
  const latest = new Map();
  let tracking = false;
  let changesThisPage = 0;
  // The start-up sync found the page outdated and reloads it.
  let reloading = false;

  const db = () => hyperbook.store.db;
  const syncedTables = () => db().tables.filter((t) => EPHEMERAL_TABLES.indexOf(t.name) === -1);

  function keyOf(table, row) {
    const keyPath = table.schema.primKey.keyPath;
    if (Array.isArray(keyPath)) return keyPath.map((k) => row[k]);
    return row[keyPath];
  }

  function setPath(obj, path, value) {
    const parts = path.split(".");
    let target = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof target[parts[i]] !== "object" || target[parts[i]] === null) target[parts[i]] = {};
      target = target[parts[i]];
    }
    if (value === undefined) delete target[parts[parts.length - 1]];
    else target[parts[parts.length - 1]] = value;
  }

  function markDirty(table, key, value) {
    if (!tracking || key === undefined) return;
    const name = markName(table, key);
    let base = syncedRevision();
    try {
      // Downloads leave a marked row alone, so the device has not seen other
      // devices' changes to it since it first changed it.
      const previous = JSON.parse(read(name));
      if (previous && typeof previous.base === "number") base = previous.base;
    } catch {}
    const mark = { at: Date.now(), base, n: nonce() };
    write(name, JSON.stringify(mark));
    changesThisPage += 1;
    latest.set(name, value);
    scheduler.changed();
  }

  /** Watches every synced table; runs before any element touches the store. */
  function installHooks() {
    syncedTables().forEach((table) => {
      table.hook("creating", function (primKey, obj, tx) {
        if (ownTransactions.has(tx)) return;
        markDirty(table.name, primKey !== undefined ? primKey : keyOf(table, obj), obj);
      });
      table.hook("updating", function (mods, primKey, obj, tx) {
        // A put of an unchanged row reports no modifications.
        if (ownTransactions.has(tx) || Object.keys(mods).length === 0) return;
        const next = JSON.parse(JSON.stringify(obj));
        Object.keys(mods).forEach((path) => setPath(next, path, mods[path]));
        markDirty(table.name, primKey, next);
      });
      table.hook("deleting", function (primKey, _obj, tx) {
        if (ownTransactions.has(tx)) return;
        markDirty(table.name, primKey, null);
      });
    });
  }

  /**
   * Writes rows from the server into the local store, leaving out rows this
   * device has not uploaded yet. The marks are checked inside the transaction:
   * a change made while the rows were on their way is newer than they are.
   * With `replaceAll`, the synced tables are emptied first.
   * Returns how many rows changed locally.
   */
  async function applyRows(rows, replaceAll = false) {
    const tables = syncedTables();
    const byName = {};
    tables.forEach((t) => (byName[t.name] = t));
    const wanted = rows.filter((r) => byName[r.table]);
    if (wanted.length === 0 && !replaceAll) return 0;

    let changed = 0;
    await db().transaction("rw", tables, async (tx) => {
      ownTransactions.add(tx);
      if (replaceAll) {
        for (const t of tables) changed += await t.count();
        for (const t of tables) await t.clear();
      } else {
        // The callback runs as soon as the transaction is created, but it is
        // only granted once earlier writes (an element's change) committed.
        // A first answered request means it was: their marks exist now, and
        // later writes wait for this transaction and land on top of it.
        await tables[0].count();
      }
      for (const row of wanted) {
        if (!replaceAll && isMarked(row.table, row.key)) continue;
        const table = byName[row.table];
        if (row.data === null) {
          await table.delete(row.key);
        } else if (table.schema.primKey.keyPath) {
          await table.put(row.data);
        } else {
          await table.put(row.data, row.key);
        }
        changed += 1;
      }
    });
    return changed;
  }

  /**
   * The current value of each marked row (null if deleted), read in one go,
   * with when it changed and the revision it was based on. Marks of tables
   * this book no longer has are dropped.
   */
  async function readRows(marks) {
    const rows = [];
    const tables = syncedTables();
    const names = tables.map((t) => t.name);
    await db().transaction("r", tables, async () => {
      for (const m of marks) {
        if (names.indexOf(m.table) === -1) {
          unmark(m);
          continue;
        }
        const data = await db().table(m.table).get(m.key);
        rows.push({
          table: m.table,
          key: m.key,
          data: data === undefined ? null : data,
          at: m.mark.at,
          base: m.mark.base,
        });
      }
    });
    return rows;
  }

  async function readAllRows() {
    const rows = [];
    for (const table of syncedTables()) {
      (await table.toArray()).forEach((data) => rows.push({ table: table.name, key: keyOf(table, data), data }));
    }
    return rows;
  }

  // ===== Talking to the server =====

  function getAuthToken() {
    if (SAME_ORIGIN) return null;
    return localStorage.getItem(`${AUTH_TOKEN_KEY}:${bookKey()}`);
  }

  /**
   * Remembers who is logged in, for the interface: `{ username, readonly }`.
   * The server decides; this copy only spares a request before the first
   * paint and is refreshed from /session on every page load.
   */
  function setAuthUser(user, token) {
    if (token) localStorage.setItem(`${AUTH_TOKEN_KEY}:${bookKey()}`, token);
    localStorage.setItem(`${AUTH_USER_KEY}:${bookKey()}`, JSON.stringify(user));
  }

  function clearAuth() {
    localStorage.removeItem(`${AUTH_TOKEN_KEY}:${bookKey()}`);
    localStorage.removeItem(`${AUTH_USER_KEY}:${bookKey()}`);
  }

  function getAuthUser() {
    if (!HYPERBOOK_CLOUD) return null;
    try {
      return JSON.parse(localStorage.getItem(`${AUTH_USER_KEY}:${bookKey()}`)) || null;
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    if (!HYPERBOOK_CLOUD) return false;
    return SAME_ORIGIN ? getAuthUser() !== null : getAuthToken() !== null;
  }

  /** A teacher looking at a student's work: nothing may be saved. */
  function isReadOnlyMode() {
    const user = getAuthUser();
    return !!(user && user.readonly);
  }

  /** Whose state the local store should hold, or null. */
  function identity() {
    const user = getAuthUser();
    if (!user || !isLoggedIn()) return null;
    return (user.readonly ? "view:" : "") + user.username;
  }

  function requestHeaders(extra) {
    const headers = { "Content-Type": "application/json", ...extra };
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  /** A JSON request to the API. Failures throw an Error with `status` (0: network). */
  async function apiRequest(endpoint, options = {}) {
    let response;
    const signal =
      typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
        ? AbortSignal.timeout(REQUEST_TIMEOUT)
        : undefined;
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        signal,
        headers: requestHeaders(options.headers),
        credentials: SAME_ORIGIN ? "same-origin" : "omit",
      });
    } catch (cause) {
      const err = new Error("Network error");
      err.status = 0;
      throw err;
    }

    // Only 401 means the session is gone. A 403 is a refused action (such as
    // saving in a read-only view) and must not log anyone out.
    if (response.status === 401 && !options.allowUnauthorized) {
      clearAuth();
      // Keep marking: what the student does while the login drawer is open
      // is uploaded once the same student logs in again (catchUp). Only the
      // waiting uploads stop; sync() does nothing while logged out.
      scheduler.clear();
      updateUserUI(null);
      showLogin();
    }

    let data = null;
    try {
      data = await response.json();
    } catch {}
    if (!response.ok) {
      const err = new Error((data && data.error) || "Request failed");
      err.status = response.status;
      throw err;
    }
    return data;
  }

  /**
   * The body of an upload, gzip-compressed when it is large and the browser
   * can compress. Falls back to plain JSON, which the server also accepts.
   * @param {string} json
   * @returns {Promise<{ body: string | ArrayBuffer, headers: Record<string, string> }>}
   */
  async function encodeUpload(json) {
    if (json.length < COMPRESS_MIN_SIZE || typeof CompressionStream === "undefined") {
      return { body: json, headers: {} };
    }
    try {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
      const body = await new Response(stream).arrayBuffer();
      return { body, headers: { "Content-Encoding": "gzip" } };
    } catch {
      return { body: json, headers: {} };
    }
  }

  // ===== Upload scheduling =====

  /** The server answered that the student's saved work is at its limit. */
  let storeFull = false;

  const scheduler = {
    debounce: null,
    maxWait: null,
    retry: null,
    retryCount: 0,
    /** @type {Promise<number> | null} */
    running: null,
    again: false,
    lastSaveTime: 0,

    changed() {
      updateSaveStatus("unsaved");
      clearTimeout(this.debounce);
      this.debounce = setTimeout(() => this.flush(), PUSH_DELAY);
      if (!this.maxWait) this.maxWait = setTimeout(() => this.flush(), PUSH_MAX_WAIT);
    },

    clear() {
      clearTimeout(this.debounce);
      clearTimeout(this.maxWait);
      clearTimeout(this.retry);
      this.debounce = this.maxWait = this.retry = null;
    },

    /**
     * Uploads now. A call while one runs makes it run once more after.
     * Resolves to the number of rows that changed locally; never rejects.
     * @returns {Promise<number>}
     */
    flush() {
      this.clear();
      if (this.running) {
        this.again = true;
        return this.running;
      }
      this.running = sync()
        .then((changed) => {
          this.retryCount = 0;
          storeFull = false;
          return changed;
        })
        .catch((error) => {
          // Refused rows are set aside by the upload itself; what reaches
          // here is retried only when it may go through later.
          // 507: the student's saved work is at its limit. Retrying does not
          // help; the notice says so, and the marks wait for "Retry".
          storeFull = error.status === 507;
          const transient =
            error.status === 0 || (error.status >= 500 && error.status !== 507) || error.status === 429;
          if (transient && tracking) {
            const delay = Math.min(RETRY_MAX, 1000 * Math.pow(2, this.retryCount++));
            this.retry = setTimeout(() => this.flush(), delay);
          }
          if (error.status !== 401) updateSaveStatus(navigator.onLine ? "error" : "offline");
          return 0;
        })
        .finally(() => {
          this.running = null;
          if (this.again) {
            this.again = false;
            if (tracking && isDirty()) this.flush();
          }
        });
      return this.running;
    },
  };

  /** "Save now" and "Retry": also tries the rows the server refused before. */
  function saveNow() {
    readMarks().forEach((m) => {
      if (!m.mark.refused) return;
      const { refused, ...mark } = m.mark;
      write(m.name, JSON.stringify(mark));
    });
    return scheduler.flush();
  }

  /**
   * Runs `fn` while no other tab of this book syncs, where the browser can
   * tell: two tabs taking in answers at once could store an older answer
   * over a newer one.
   */
  function withSyncLock(fn) {
    const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
    if (!locks || typeof locks.request !== "function") return fn();
    return locks.request(`${prefix()}sync`, fn);
  }

  /** Splits an upload into requests the server takes in quickly. */
  function batches(rows) {
    const out = [];
    let batch = [];
    let size = 0;
    for (const row of rows) {
      const rowSize = JSON.stringify(row).length;
      if (batch.length > 0 && (batch.length >= BATCH_MAX_ROWS || size + rowSize > BATCH_MAX_SIZE)) {
        out.push(batch);
        batch = [];
        size = 0;
      }
      batch.push(row);
      size += rowSize;
    }
    if (batch.length > 0) out.push(batch);
    return out;
  }

  async function postRows(rows, replace) {
    const json = JSON.stringify({ since: syncedRevision(), rows, replace });
    const upload = await encodeUpload(json);
    return apiRequest("/store", { method: "POST", body: upload.body, headers: upload.headers });
  }

  /** Takes in the server's answer to a request. Returns how many rows changed locally. */
  async function takeIn(result) {
    const changed = await applyRows(result.rows || []);
    writeRevision(result.revision);
    return changed;
  }

  /**
   * Uploads rows in batches and takes in each answer. A batch the server
   * refuses (too large, invalid) is split until each refused row is alone;
   * that row is set aside, so it never holds up the others.
   * With `replace`, the first request replaces the saved state and the rest
   * follow on top of it.
   * Returns how many rows changed locally and how many the server refused.
   */
  async function uploadRows(rows, marksByName, replace) {
    const queue = batches(rows);
    let replacing = replace;
    let changed = 0;
    let refused = 0;
    const refusedRows = [];
    while (queue.length > 0) {
      const batch = queue.shift();
      let result;
      try {
        result = await postRows(batch, replacing);
      } catch (error) {
        if (error.status !== 400 && error.status !== 413) throw error;
        if (batch.length > 1) {
          const half = Math.ceil(batch.length / 2);
          queue.unshift(batch.slice(0, half), batch.slice(half));
          continue;
        }
        refused += 1;
        refusedRows.push(batch[0]);
        const m = marksByName.get(markName(batch[0].table, batch[0].key));
        if (m && read(m.name) === m.raw) write(m.name, JSON.stringify({ ...m.mark, refused: true }));
        continue;
      }
      if (replacing) {
        replacing = false;
        queue.forEach((b) => b.forEach((row) => (row.base = result.revision)));
      }
      batch.forEach((row) => {
        const m = marksByName.get(markName(row.table, row.key));
        if (m) unmark(m);
      });
      changed += await takeIn(result);
    }
    // Every row was refused: the saved state still has to be replaced.
    if (replacing) changed += await takeIn(await postRows([], true));
    return { changed, refused, refusedRows };
  }

  /**
   * One round: uploads the marked rows (if any) and takes in what other
   * devices saved since this device last looked.
   * Returns how many rows changed locally.
   */
  function sync() {
    return withSyncLock(async () => {
      // Logged out (the session expired): changes stay marked until the
      // student logs in again; see the 401 handling in apiRequest.
      if (!syncedStudent() || !identity()) return 0;
      const replace = tracking && replacePending();
      const marks = !tracking ? [] : replace ? readMarks() : pendingMarks();
      let changed = 0;
      let refused = 0;

      if (replace || marks.length > 0) {
        updateSaveStatus("saving");
        if (replace) {
          // The whole store, as it is now, covers every change marked so far.
          const at = Date.now();
          const rows = (await readAllRows()).map((row) => ({ ...row, at }));
          let refusedRows;
          ({ changed, refused, refusedRows } = await uploadRows(rows, new Map(), true));
          erase("replace");
          marks.forEach(unmark);
          // The replace deleted the saved copies of the rows it could not
          // store: they wait as refused marks, like any refused change.
          for (const row of refusedRows) {
            write(markName(row.table, row.key), JSON.stringify({ at, base: syncedRevision(), n: nonce(), refused: true }));
          }
        } else {
          const rows = await readRows(marks);
          ({ changed, refused } = await uploadRows(rows, new Map(marks.map((m) => [m.name, m])), false));
        }
      } else {
        changed = await takeIn(await apiRequest(`/store?since=${syncedRevision()}`));
      }

      if (tracking) {
        scheduler.lastSaveTime = Date.now();
        updateSaveStatus(refused > 0 || hasRefused() ? "error" : isDirty() ? "unsaved" : "saved");
      }
      if (changed > 0 && changesThisPage > 0) showUpdatedNotice();
      return changed;
    });
  }

  /**
   * Last chance while the page goes away: a keepalive request outlives the
   * document. Best effort — the marks stay until a later page load confirms
   * the upload, so nothing depends on it. Not compressed: compressing is
   * asynchronous, and the page may be gone before it finishes.
   */
  function flushOnHide() {
    if (!tracking || replacePending() || !navigator.onLine) return;
    const marks = pendingMarks();
    if (marks.length === 0) return;
    const rows = [];
    for (const m of marks) {
      if (!latest.has(m.name)) return; // changed on an earlier page or in another tab
      rows.push({ table: m.table, key: m.key, data: latest.get(m.name), at: m.mark.at, base: m.mark.base });
    }
    const body = JSON.stringify({ since: syncedRevision(), rows });
    if (body.length > KEEPALIVE_MAX_SIZE) return;
    try {
      fetch(`${API_BASE}/store`, {
        method: "POST",
        keepalive: true,
        headers: requestHeaders(),
        credentials: SAME_ORIGIN ? "same-origin" : "omit",
        body,
      }).catch(() => {});
    } catch {}
  }

  function stopTracking() {
    tracking = false;
    scheduler.clear();
  }

  // ===== Start-up =====

  /**
   * Hand-offs in the address's fragment, for books hosted elsewhere (a hosted
   * book gets these on the platform's own pages instead):
   *  - `#hyperbook-impersonate=<token>`: a teacher opened a read-only view of
   *    a student's work from Hyperbook Cloud.
   *  - `#hyperbook-key=<key>`: a student scanned the QR code on a login card.
   * Read once and removed from the address right away.
   */
  let pendingHandoff = null;
  (function readHandoff() {
    if (!HYPERBOOK_CLOUD || SAME_ORIGIN) return;
    const match = window.location.hash.match(/^#hyperbook-(impersonate|key)=([A-Za-z0-9_-]+)$/);
    if (!match) return;
    pendingHandoff = { kind: match[1], value: match[2] };
    history.replaceState(null, "", window.location.pathname + window.location.search);
  })();

  /** Completes a hand-off read from the address (see readHandoff). */
  async function completeHandoff() {
    const { kind, value } = pendingHandoff;
    pendingHandoff = null;
    if (kind === "impersonate") {
      clearAuth();
      localStorage.setItem(`${AUTH_TOKEN_KEY}:${bookKey()}`, value);
      return refreshSession();
    }
    try {
      const data = await apiRequest("/login/key", {
        method: "POST",
        allowUnauthorized: true,
        body: JSON.stringify({ key: value, token: true }),
      });
      if (data && data.token) {
        setAuthUser({ username: data.user.username, readonly: false }, data.token);
        return true;
      }
    } catch (error) {
      console.error("Login with the QR code failed:", error);
    }
    return false;
  }

  /**
   * Asks the server who is logged in and remembers it. Returns false when
   * nobody is (any more).
   */
  async function refreshSession() {
    try {
      const data = await apiRequest("/session", { allowUnauthorized: true });
      if (data && data.user) {
        setAuthUser({ username: data.user.username, readonly: !!data.readonly });
        return true;
      }
    } catch (error) {
      // Offline or the server is down: keep what we knew.
      if (error.status !== 401) return isLoggedIn();
    }
    clearAuth();
    return false;
  }

  /**
   * Brings the local store in line with the logged-in student's saved state.
   * Returns true when the page shows outdated data and must reload.
   */
  async function catchUp() {
    const who = identity();
    if (!who) return false;
    if (syncedStudent() !== who) {
      // One tab at a time: a second tab must not clear the marks and rows of
      // the first while it uploads them.
      const first = await withSyncLock(async () => {
        if (syncedStudent() === who) return null; // another tab did it meanwhile
        // Never synced on this device: what it holds is this reader's own
        // work from before logging in. Another student's data is not.
        const fresh = syncedStudent() === null;
        tracking = false;
        clearSyncState();
        const result = await apiRequest("/store");
        if (
          fresh &&
          !isReadOnlyMode() &&
          validRevision(result.revision) === 0 &&
          (await readAllRows()).length > 0
        ) {
          // Nothing saved yet: the device's work becomes the saved state.
          write("revision", "0");
          write("student", who);
          write("replace", "1");
          tracking = true;
          return { changed: 0, upload: true };
        }
        const changed = await applyRows(result.rows || [], true);
        writeRevision(result.revision);
        write("student", who);
        tracking = !isReadOnlyMode();
        return { changed, upload: false };
      });
      if (first !== null) {
        if (first.upload) await scheduler.flush();
        return first.changed > 0;
      }
    }
    tracking = !isReadOnlyMode();
    if (!tracking) readMarks().forEach((m) => erase(m.name));
    const changed = await scheduler.flush();
    // Reload only while the reader has not started working on this page;
    // otherwise the notice offers it.
    return changed > 0 && changesThisPage === 0;
  }

  /** The promise of the start-up sync, for tests and for logging in. */
  let ready = Promise.resolve();

  function start() {
    if (!HYPERBOOK_CLOUD) return;
    // Track from the first moment, before any element writes: if this is the
    // same student as last time, those writes are their work.
    const who = identity();
    if (who && syncedStudent() === who && !isReadOnlyMode()) tracking = true;
    installHooks();

    window.addEventListener("online", () => {
      if (tracking && isDirty()) scheduler.flush();
      else if (tracking) updateSaveStatus(hasRefused() ? "error" : "saved");
    });
    window.addEventListener("offline", () => {
      if (tracking) updateSaveStatus("offline");
    });
    window.addEventListener("pagehide", flushOnHide);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && tracking && isDirty()) scheduler.flush();
    });

    ready = (async () => {
      if (pendingHandoff) {
        await completeHandoff();
      } else if (SAME_ORIGIN || getAuthToken()) {
        // The cookie (hosted books) is invisible to scripts, so ask who is
        // logged in; for a token this also notices one that expired.
        await refreshSession();
      }
      updateUserUI(getAuthUser());
      showImpersonationBanner();

      if (!identity()) {
        stopTracking();
        return;
      }
      if (isReadOnlyMode()) updateSaveStatus("readonly");
      try {
        if (await catchUp()) {
          reloading = true;
          window.location.reload();
        }
      } catch (error) {
        console.error("Could not sync with the cloud:", error);
      }
    })();
  }

  // ===== Interface =====

  const updateUserIconState = (iconState) => {
    const icon = document.querySelector(".user-icon");
    if (!icon) return;
    icon.setAttribute("data-state", iconState);
  };

  const updateUserUI = (user) => {
    const loginForm = document.getElementById("user-login-form");
    const userInfo = document.getElementById("user-info");

    if (!loginForm || !userInfo) return;

    if (user) {
      loginForm.classList.add("hidden");
      userInfo.classList.remove("hidden");
      document.getElementById("user-display-name").textContent = user.username;
      updateUserIconState("logged-in");
    } else {
      loginForm.classList.remove("hidden");
      userInfo.classList.add("hidden");
      const passwordField = document.getElementById("user-password");
      if (passwordField) passwordField.value = "";
      updateUserIconState("not-logged-in");
    }
  };

  /** "just now", "3 minutes ago", … for the last successful save. */
  const describeAge = (timestamp) => {
    if (!timestamp) return null;
    const minutes = Math.floor((Date.now() - timestamp) / 60000);
    if (minutes < 1) {
      return hyperbook.i18n.get("user-saved-just-now", {}, "just now");
    }
    if (minutes < 60) {
      return hyperbook.i18n.get(
        "user-saved-minutes-ago",
        { minutes: String(minutes) },
        `${minutes} min ago`,
      );
    }
    const hours = Math.floor(minutes / 60);
    return hyperbook.i18n.get("user-saved-hours-ago", { hours: String(hours) }, `${hours} h ago`);
  };

  /**
   * Every sync state, as one table.
   *
   * `icon` must differ by shape and not only by colour: the toolbar icon is the
   * sole ambient signal, and amber-vs-green at 24px is invisible to a red-green
   * colour blind reader. The stylesheet gives each state its own badge glyph.
   */
  const SAVE_STATES = {
    unsaved: {
      icon: "pending",
      text: () => hyperbook.i18n.get("user-unsaved", {}, "Not uploaded yet"),
    },
    saving: {
      icon: "syncing",
      text: () => hyperbook.i18n.get("user-saving", {}, "Saving..."),
    },
    saved: {
      icon: "synced",
      text: () => {
        const age = describeAge(scheduler.lastSaveTime);
        const saved = hyperbook.i18n.get("user-saved", {}, "Saved");
        return age ? `${saved} (${age})` : saved;
      },
    },
    error: {
      icon: "error",
      text: () => hyperbook.i18n.get("user-save-error", {}, "Save Error"),
    },
    offline: {
      icon: "offline",
      text: () => hyperbook.i18n.get("user-offline", {}, "Offline"),
    },
    readonly: {
      icon: "readonly",
      text: () => hyperbook.i18n.get("user-readonly", {}, "Read-Only Mode"),
    },
  };

  const NOTICE_ID = "cloud-sync-notice";
  let updatedNoticeShown = false;

  /**
   * An ambient notice for sync states the reader can do something about.
   *
   * The status line lives inside the user drawer, so until the reader opens it
   * the toolbar badge is the only signal that anything is wrong — easy to miss
   * for exactly the states that matter. This surfaces those, and only those: a
   * toast on every successful save would be noise.
   *
   * @param {{tone: string, message: string, action?: {label: string, onClick: Function}}} notice
   */
  const showSyncNotice = (notice) => {
    let el = document.getElementById(NOTICE_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = NOTICE_ID;
      // Polite: this competes with the page content a reader is in the middle
      // of, and none of these states are urgent enough to interrupt.
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }

    el.className = notice.tone;
    el.textContent = "";

    const text = document.createElement("span");
    text.textContent = notice.message;
    el.appendChild(text);

    if (notice.action) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = notice.action.label;
      button.addEventListener("click", notice.action.onClick);
      el.appendChild(button);
    }

    return el;
  };

  const dismissSyncNotice = () => {
    const el = document.getElementById(NOTICE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  };

  /**
   * Work from another device arrived while this page is open. Elements read
   * the store when they start, so the page shows it only after a reload —
   * which the reader triggers, since they may be in the middle of something.
   */
  const showUpdatedNotice = () => {
    updatedNoticeShown = true;
    showSyncNotice({
      tone: "info",
      message: hyperbook.i18n.get(
        "user-notice-updated",
        {},
        "Work from another device was loaded. Reload the page to see it.",
      ),
      action: {
        label: hyperbook.i18n.get("user-notice-reload", {}, "Reload now"),
        onClick: () => window.location.reload(),
      },
    });
  };

  /** The states worth interrupting for, and what the notice says about them. */
  const noticeFor = (status) => {
    if (status === "error") {
      return {
        tone: "error",
        message: storeFull
          ? hyperbook.i18n.get(
              "user-notice-full",
              {},
              "Your saved work has reached its size limit. Your changes are still on this device. Delete work you no longer need, or ask your teacher.",
            )
          : hyperbook.i18n.get(
              "user-notice-error",
              {},
              "Could not save to the cloud. Your changes are still on this device.",
            ),
        action: {
          label: hyperbook.i18n.get("user-notice-retry", {}, "Retry"),
          onClick: () => saveNow(),
        },
      };
    }
    if (status === "offline") {
      return {
        tone: "warning",
        message: hyperbook.i18n.get(
          "user-notice-offline",
          {},
          "Offline. Changes are kept on this device and sync when you reconnect.",
        ),
      };
    }
    return null;
  };

  const updateSaveStatus = (status) => {
    const saveState = SAVE_STATES[status];
    if (!saveState) return;

    const label = saveState.text();

    // The icon is updated first and unconditionally, so a shell rendered
    // without the user drawer still shows the state.
    updateUserIconState(saveState.icon);

    // The icon is the only sync indicator most readers ever see, so it needs an
    // accessible name that actually tracks the state.
    const toggle = document.getElementById("user-toggle");
    if (toggle) {
      toggle.setAttribute("title", label);
      toggle.setAttribute("aria-label", label);
    }

    // The "reload to see it" notice stays until the reader acts on it.
    if (!updatedNoticeShown) {
      const notice = noticeFor(status);
      if (notice) showSyncNotice(notice);
      else dismissSyncNotice();
    }

    const statusEl = document.getElementById("user-save-status");
    if (!statusEl) return;
    statusEl.className = status;
    statusEl.textContent = label;
  };

  const showLogin = () => {
    const drawer = document.getElementById("user-drawer");
    if (drawer && !drawer.hasAttribute("open")) {
      drawer.setAttribute("open", "");
      updateUserUI(null);
    }
  };

  const userToggle = () => {
    const drawer = document.getElementById("user-drawer");
    if (drawer) {
      drawer.toggleAttribute("open");
      updateUserUI(getAuthUser());
    }
  };

  /** Logs in with the drawer's form, loads the student's work and reloads. */
  const login = async () => {
    const username = document.getElementById("user-username").value;
    const password = document.getElementById("user-password").value;
    const errorEl = document.getElementById("user-login-error");

    if (!username || !password) {
      errorEl.textContent = hyperbook.i18n.get("user-login-required", {}, "Username and password required");
      return;
    }

    try {
      const sharedDevice = !!document.getElementById("user-shared-device")?.checked;
      const data = await apiRequest("/login", {
        method: "POST",
        allowUnauthorized: true,
        body: JSON.stringify({ username, password, sharedDevice, token: !SAME_ORIGIN }),
      });
      setAuthUser({ username: data.user.username, readonly: false }, data.token);
      errorEl.textContent = "";
      await catchUp();
      window.location.reload();
    } catch (error) {
      errorEl.textContent =
        error.message || hyperbook.i18n.get("user-login-failed", {}, "Login failed");
    }
  };

  /**
   * Logs out after a last upload. The local store is emptied, so the next
   * reader of a shared device does not see this student's work.
   */
  const logout = async () => {
    if (!confirm(hyperbook.i18n.get("user-logout-confirm", {}, "Are you sure you want to logout?"))) {
      return;
    }
    if (tracking && hasUnsent()) {
      await saveNow();
      if (
        hasUnsent() &&
        !confirm(
          hyperbook.i18n.get(
            "user-logout-unsaved",
            {},
            "Some of your work could not be uploaded and will be lost on this device. Log out anyway?",
          ),
        )
      ) {
        return;
      }
    }
    await forgetLocal();
    window.location.reload();
  };

  /** Ends the session and empties the local store and the sync state. */
  async function forgetLocal() {
    stopTracking();
    // The only way to remove the HttpOnly cookie of a hosted book.
    fetch(`${API_BASE}/logout`, {
      method: "POST",
      headers: requestHeaders(),
      credentials: SAME_ORIGIN ? "same-origin" : "omit",
      body: "{}",
    }).catch(() => {});
    clearAuth();
    clearSyncState();
    try {
      await db().transaction("rw", syncedTables(), async (tx) => {
        ownTransactions.add(tx);
        for (const t of syncedTables()) await t.clear();
      });
    } catch (error) {
      console.error("Could not empty the local store:", error);
    }
  }

  /**
   * Uploads the whole store in place of the saved one: after the reader
   * imported a file or reset everything. Kept as a mark until it went through.
   */
  async function replaceAll() {
    if (!tracking || !syncedStudent()) return;
    write("replace", "1");
    readMarks().forEach((m) => erase(m.name));
    latest.clear();
    await scheduler.flush();
  }

  // Initialize user UI on load
  document.addEventListener("DOMContentLoaded", () => {
    const user = getAuthUser();
    if (user) updateUserUI(user);

    // Hide local export/import/reset when logged into cloud
    if (isLoggedIn()) {
      document.querySelectorAll(".export-icon, .import-icon, .reset-icon").forEach((el) => {
        const link = el.closest("a");
        if (link) link.style.display = "none";
      });
    }

    showImpersonationBanner();
  });

  /**
   * Says whose work a teacher is looking at. Called on load and again once
   * the session check answers, since a hosted book only learns from the
   * server that its session is read-only.
   */
  function showImpersonationBanner() {
    if (!isReadOnlyMode() || document.getElementById("impersonation-banner")) return;
    const user = getAuthUser();
    const banner = document.createElement("div");
    banner.id = "impersonation-banner";
    // Built as nodes, not innerHTML: the username is interpolated here and
    // is whatever the account was registered with.
    const label = document.createElement("span");
    label.appendChild(
      document.createTextNode(`${hyperbook.i18n.get("user-impersonating", {}, "Impersonating")}: `),
    );
    const name = document.createElement("strong");
    name.textContent = user ? user.username : "";
    label.appendChild(name);
    label.appendChild(
      document.createTextNode(` — ${hyperbook.i18n.get("user-readonly", {}, "Read-Only Mode")}`),
    );

    const exit = document.createElement("a");
    exit.href = "#";
    exit.id = "exit-impersonation";
    exit.textContent = hyperbook.i18n.get("user-exit-impersonation", {}, "Exit Impersonation");

    banner.appendChild(label);
    banner.appendChild(exit);
    document.body.prepend(banner);

    exit.addEventListener("click", async (e) => {
      e.preventDefault();
      await forgetLocal();
      window.close();
      window.location.reload();
    });
  }

  start();

  return {
    save: () => saveNow(),
    replaceAll,
    userToggle,
    login,
    logout,
    /**
     * Internals for the test suite: this asset ships as a plain script with
     * no module boundary.
     */
    _internal: () => ({
      ready,
      sync: {
        student: syncedStudent(),
        revision: syncedRevision(),
        replace: replacePending(),
        marks: readMarks(),
      },
      tracking,
      reloading,
      scheduler,
      isDirty,
    }),
  };
})();
