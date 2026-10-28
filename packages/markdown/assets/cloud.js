/// <reference path="./hyperbook.types.js" />
window.hyperbook = window.hyperbook || {};

/**
 * Cloud sync integration for hyperbook store data.
 * Handles authentication, event-based sync, and snapshot sync.
 *
 * Two modes, set by the `cloud` entry of hyperbook.json:
 *  - `{ sameOrigin: true }`: the book is hosted by Hyperbook Cloud, which sets
 *    this when it builds the book. The API is on the book's own host and the
 *    session is an HttpOnly cookie the script never sees.
 *  - `{ url, id }`: the book is hosted elsewhere and talks to its address on
 *    Hyperbook Cloud cross-origin, with a Bearer token in localStorage.
 * @type {HyperbookCloud}
 * @memberof hyperbook
 * @see hyperbook.store
 * @see hyperbook.i18n
 */
hyperbook.cloud = (function () {
  // ===== Cloud Integration =====
  const AUTH_TOKEN_KEY = "hyperbook_auth_token";
  const AUTH_USER_KEY = "hyperbook_auth_user";
  const SAME_ORIGIN = !!(HYPERBOOK_CLOUD && HYPERBOOK_CLOUD.sameOrigin);
  const API_BASE = !HYPERBOOK_CLOUD
    ? ""
    : (SAME_ORIGIN ? "" : String(HYPERBOOK_CLOUD.url || "").replace(/\/+$/, "")) +
      "/_hyperbook/api";
  const LAST_EVENT_ID_PREFIX = "hyperbook_last_event_id";
  const EVENT_BATCH_MAX_SIZE = 512 * 1024; // 512KB
  const OFFLINE_QUEUE_MAX_SIZE = 100; // cap offline queue to avoid unbounded memory growth
  // Browsers cap the combined body size of all in-flight keepalive requests at
  // 64KB and reject anything larger outright. Stay under it with some slack.
  const KEEPALIVE_MAX_SIZE = 60 * 1024;
  // Tables holding ephemeral UI state that must never be synced. Kept in one
  // place so the event hooks and the snapshot export cannot drift apart.
  const EPHEMERAL_TABLES = ["currentState"];
  // How long the merge notice stays up before the page reloads itself. Long
  // enough to read a sentence, short enough that the stale DOM is not usable.
  const MERGE_RELOAD_DELAY = 4000;
  let isLoadingFromCloud = false;
  let syncManager = null;
  let mergeNoticeShown = false;

  /**
   * The event watermark is per hyperbook: two hyperbooks served from the same
   * origin share localStorage, and a single global key made each one send the
   * other's `afterEventId`, producing a permanent 409 conflict loop.
   */
  function lastEventIdKey() {
    return HYPERBOOK_CLOUD
      ? `${LAST_EVENT_ID_PREFIX}:${bookKey()}`
      : LAST_EVENT_ID_PREFIX;
  }

  /**
   * Names this book's entries in localStorage. A hosted book is alone on its
   * origin; books hosted elsewhere may share one (several books on one
   * GitHub Pages site), so theirs carry the id.
   */
  function bookKey() {
    return SAME_ORIGIN ? "cloud" : HYPERBOOK_CLOUD.id;
  }

  function readLastEventId() {
    const stored = localStorage.getItem(lastEventIdKey());
    if (stored !== null) return parseInt(stored, 10) || 0;

    // Migrate from the pre-namespacing global key.
    const legacy = localStorage.getItem(LAST_EVENT_ID_PREFIX);
    if (legacy !== null) {
      localStorage.setItem(lastEventIdKey(), legacy);
      localStorage.removeItem(LAST_EVENT_ID_PREFIX);
      return parseInt(legacy, 10) || 0;
    }

    return 0;
  }

  function writeLastEventId(id) {
    localStorage.setItem(lastEventIdKey(), String(id));
  }

  function clearLastEventIds() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LAST_EVENT_ID_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  }

  // ===== Simple Mutex =====
  class Mutex {
    constructor() {
      this._queue = [];
      this._locked = false;
    }
    async runExclusive(fn) {
      await new Promise((resolve) => {
        if (!this._locked) {
          this._locked = true;
          resolve();
        } else {
          this._queue.push(resolve);
        }
      });
      try {
        return await fn();
      } finally {
        if (this._queue.length > 0) {
          this._queue.shift()();
        } else {
          this._locked = false;
        }
      }
    }
  }

  // ===== Smart Sync Strategy =====

  class SyncManager {
    constructor(options = {}) {
      this.debounceDelay = options.debounceDelay || 2000;
      this.maxWaitTime = options.maxWaitTime || 10000;
      this.minSaveInterval = options.minSaveInterval || 1000;

      this.lastSaveTime = 0;
      this.lastChangeTime = 0;
      this.debounceTimer = null;
      this.maxWaitTimer = null;
      this.saveInProgress = false;
      this.saveMutex = new Mutex();
      this.retryCount = 0;

      this.pendingEvents = [];
      this.lastEventId = readLastEventId();

      this.offlineQueue = [];
      this.processingQueue = false;
      this.unloadFlushed = false;
      this.isOnline = navigator.onLine;

      this.setupEventListeners();
    }

    get isDirty() {
      return this.pendingEvents.length > 0;
    }

    addEvent(event) {
      if (isLoadingFromCloud || isReadOnlyMode()) return;
      // A cancelled unload leaves the flush latched. New work needs a new
      // chance to be flushed if the user tries to leave again.
      this.unloadFlushed = false;
      this.pendingEvents.push(event);
      this.lastChangeTime = Date.now();
      this.updateUI("unsaved");
      this.scheduleSave();
    }

    scheduleSave() {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      if (!this.maxWaitTimer) {
        this.maxWaitTimer = setTimeout(() => {
          this.performSave("max-wait");
        }, this.maxWaitTime);
      }
      this.debounceTimer = setTimeout(() => {
        this.performSave("debounced");
      }, this.debounceDelay);
    }

    async performSave(reason = "manual") {
      if (!this.isDirty || this.saveInProgress) return;
      if (!HYPERBOOK_CLOUD || !isLoggedIn()) return;
      if (isReadOnlyMode()) {
        this.updateUI("readonly");
        return;
      }

      const timeSinceLastSave = Date.now() - this.lastSaveTime;
      if (timeSinceLastSave < this.minSaveInterval) {
        setTimeout(
          () => this.performSave(reason),
          this.minSaveInterval - timeSinceLastSave,
        );
        return;
      }

      return this.saveMutex.runExclusive(async () => {
        this.saveInProgress = true;
        this.clearTimers();

        // Snapshot exactly which events we're attempting to send, so that any
        // events added during the async save are not lost. Only this prefix is
        // ever removed from the queue.
        const eventsToSend = this.pendingEvents.slice();

        // Another save may have drained the queue while we waited on the mutex.
        // Sending an empty batch is a 400, which would wedge the retry loop.
        if (eventsToSend.length === 0) {
          this.saveInProgress = false;
          return;
        }

        this.updateUI("saving");

        try {
          const serialized = JSON.stringify(eventsToSend);

          if (!this.isOnline) {
            // Enforce the queue size cap to prevent unbounded memory growth.
            if (this.offlineQueue.length >= OFFLINE_QUEUE_MAX_SIZE) {
              console.warn("Offline queue full — falling back to snapshot on reconnect");
              this.offlineQueue = [{ snapshot: true, timestamp: Date.now() }];
            } else {
              this.offlineQueue.push({
                events: eventsToSend,
                timestamp: Date.now(),
              });
            }
            this.pendingEvents = this.pendingEvents.slice(eventsToSend.length);
            this.updateUI("offline-queued");
            return;
          }

          let result;

          if (serialized.length > EVENT_BATCH_MAX_SIZE) {
            // Large batch — fall back to full snapshot
            result = await this.sendSnapshot();
          } else {
            // Normal path — send events
            result = await this.sendEvents(eventsToSend);
          }

          if (result.conflict) {
            await this.resolveConflict(eventsToSend);
            return;
          }

          // Only discard the events we snapshotted, preserving any events that
          // were added while the network request was in flight.
          this.pendingEvents = this.pendingEvents.slice(eventsToSend.length);
          this.lastEventId = result.lastEventId;
          writeLastEventId(this.lastEventId);
          this.lastSaveTime = Date.now();
          this.retryCount = 0;
          this.updateUI("saved");
          console.log(`✓ Saved (${reason})`);
        } catch (error) {
          console.error("Save failed:", error);
          this.updateUI("error");

          // A 4xx (other than the 409 handled above) means the server will
          // never accept this batch. Retrying forever would pin the queue and
          // block every later change, so drop it and move on.
          if (error.status >= 400 && error.status < 500) {
            console.error("Dropping rejected event batch:", eventsToSend);
            this.pendingEvents = this.pendingEvents.slice(eventsToSend.length);
            this.retryCount = 0;
          } else {
            this.scheduleRetry();
          }
        } finally {
          this.saveInProgress = false;
        }
      });
    }

    /**
     * Recover from a 409 without losing local work.
     *
     * A conflict means another session advanced the server past our watermark.
     * The previous behaviour re-fetched, dropped the pending batch and
     * reloaded, which silently discarded everything the user had just done.
     * Instead we pull the server state, replay our pending events on top of it
     * both locally and remotely, and only then reload so the page reflects the
     * merged result.
     */
    async resolveConflict(eventsToSend) {
      console.log("⚠ Stale state detected, merging with cloud state...");

      await loadFromCloud();
      await applyEventsLocally(eventsToSend);

      const result = await this.sendEvents(eventsToSend, {
        afterEventId: this.lastEventId,
      });

      if (result.conflict) {
        // Someone wrote again while we were merging. Leave the events queued
        // and let the retry backoff have another go rather than looping here.
        this.updateUI("error");
        this.scheduleRetry();
        return;
      }

      this.pendingEvents = this.pendingEvents.slice(eventsToSend.length);
      this.lastEventId = result.lastEventId;
      writeLastEventId(this.lastEventId);
      this.lastSaveTime = Date.now();
      this.retryCount = 0;

      // Anything the user changed while we were merging is not in the state we
      // just pulled, and the reload below would discard it. Flush it first.
      if (this.pendingEvents.length > 0) {
        const rest = this.pendingEvents.slice();
        const restResult = await this.sendEvents(rest, {
          afterEventId: this.lastEventId,
        });

        if (restResult.conflict) {
          // Still racing. Leave the events queued for the retry backoff and
          // skip the reload rather than dropping them.
          this.updateUI("unsaved");
          this.scheduleRetry();
          return;
        }

        this.pendingEvents = this.pendingEvents.slice(rest.length);
        this.lastEventId = restResult.lastEventId;
        writeLastEventId(this.lastEventId);
      }

      // Reload so rendered components pick up the merged state. Directives read
      // the store once at startup, so the DOM is stale until we do.
      announceMergeAndReload();
    }

    async sendEvents(events, options = {}) {
      const afterEventId = options.afterEventId !== undefined
        ? options.afterEventId
        : this.lastEventId;
      try {
        const data = await apiRequest(
          "/store/events",
          {
            method: "POST",
            body: JSON.stringify({
              events: events,
              afterEventId: afterEventId,
            }),
          },
        );
        return { lastEventId: requireEventId(data), conflict: false };
      } catch (error) {
        if (error.status === 409) {
          return { conflict: true };
        }
        throw error;
      }
    }

    async sendSnapshot() {
      // Exclude ephemeral tables, matching the tables the event hooks skip.
      // Including them here pushed local cursor/scroll state to the cloud and
      // then pulled another session's back down on the next load.
      const storeExport = await hyperbook.store.db.export({
        prettyJson: false,
        filter: (table) => EPHEMERAL_TABLES.indexOf(table) === -1,
      });
      const exportData = JSON.parse(await storeExport.text());

      const data = await apiRequest(
        "/store/snapshot",
        {
          method: "POST",
          body: JSON.stringify({
            data: {
              version: 1,
              origin: window.location.origin,
              data: { hyperbook: exportData },
            },
          }),
        },
      );
      return { lastEventId: requireEventId(data), conflict: false };
    }

    scheduleRetry() {
      const retryDelay = Math.min(30000, 1000 * Math.pow(2, this.retryCount));
      this.retryCount++;
      setTimeout(() => {
        if (this.isDirty) {
          this.performSave("retry");
        }
      }, retryDelay);
    }

    setupEventListeners() {
      window.addEventListener("online", () => {
        this.isOnline = true;
        this.processOfflineQueue();
        if (this.isDirty) {
          this.updateUI("unsaved");
          this.scheduleSave();
        } else {
          this.updateUI("saved");
        }
      });

      window.addEventListener("offline", () => {
        this.isOnline = false;
        this.updateUI("offline");
      });

      window.addEventListener("beforeunload", (e) => {
        this.flushOnUnload();
        if (this.isDirty) {
          e.preventDefault();
          e.returnValue = "";
        }
      });

      // beforeunload does not fire on mobile Safari or when a background tab is
      // discarded; pagehide does. Both call the same guarded flush.
      window.addEventListener("pagehide", () => {
        this.flushOnUnload();
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden && this.isDirty) {
          this.performSave("visibility-change");
        }
      });
    }

    /**
     * Last-ditch flush while the page is going away.
     *
     * A normal save is debounced by up to `debounceDelay`, so closing the tab
     * mid-window silently dropped everything changed in it — the beforeunload
     * prompt only warned, it never sent anything. `fetch(keepalive)` outlives
     * the document teardown. `navigator.sendBeacon` cannot be used here: it has
     * no way to set the Authorization header.
     *
     * Fire-and-forget by necessity, so it deliberately does not touch
     * `pendingEvents` or the watermark. If the unload is cancelled the events
     * are still queued and the next save resends them; the server rejects that
     * duplicate with a 409 and `resolveConflict` merges it away.
     */
    flushOnUnload() {
      if (this.unloadFlushed) return;
      if (!this.isDirty || !this.isOnline) return;
      if (!HYPERBOOK_CLOUD || !isLoggedIn() || isReadOnlyMode()) return;

      const body = JSON.stringify({
        events: this.pendingEvents,
        afterEventId: this.lastEventId,
      });

      // Over the keepalive budget the request is refused rather than truncated,
      // which would lose the batch just as surely. Leave it queued so the
      // beforeunload prompt is the user's cue not to close the tab yet.
      if (body.length > KEEPALIVE_MAX_SIZE) {
        console.warn("Pending changes too large to flush on unload");
        return;
      }

      this.unloadFlushed = true;
      try {
        fetch(`${API_BASE}/store/events`, {
          method: "POST",
          keepalive: true,
          headers: requestHeaders(),
          credentials: SAME_ORIGIN ? "same-origin" : "omit",
          body: body,
        }).catch(() => {});
      } catch (error) {
        // The document is being torn down; there is nothing useful left to do.
      }
    }

    async processOfflineQueue() {
      if (this.offlineQueue.length === 0) return;

      // The "online" event can fire again while a drain is still in flight
      // (flaky connections do this readily). Without a guard both runs send
      // the same batch, and the second one is answered with a 409.
      if (this.processingQueue) return;
      this.processingQueue = true;

      try {
        await this.drainOfflineQueue();
      } finally {
        this.processingQueue = false;
      }
    }

    async drainOfflineQueue() {
      console.log(`Processing ${this.offlineQueue.length} queued saves...`);

      // FIX: if the queue was compacted to a snapshot sentinel, send a full
      // snapshot instead of trying to replay individual events
      if (this.offlineQueue.length === 1 && this.offlineQueue[0].snapshot) {
        this.offlineQueue = [];
        try {
          const result = await this.sendSnapshot();
          this.lastEventId = result.lastEventId;
          writeLastEventId(this.lastEventId);
          this.lastSaveTime = Date.now();
          console.log("✓ Offline snapshot flushed");
        } catch (error) {
          console.error("Failed to flush offline snapshot:", error);
        }
        return;
      }

      // Send queued batches in order, chaining each one onto the watermark the
      // previous batch produced. Recording `afterEventId` at enqueue time was
      // wrong: the watermark cannot advance while offline, so every batch after
      // the first carried a stale id and was rejected with a 409.
      for (let i = 0; i < this.offlineQueue.length; i++) {
        const queued = this.offlineQueue[i];
        try {
          const result = await this.sendEvents(queued.events, {
            afterEventId: this.lastEventId,
          });

          if (result.conflict) {
            // Another session moved ahead of us. Merge instead of discarding:
            // drop the flushed prefix, then replay what is left on top of the
            // fetched state.
            console.log("⚠ Offline queue conflict, merging with cloud state...");
            const remaining = this.offlineQueue.slice(i).reduce(
              (all, entry) => all.concat(entry.events || []),
              [],
            );
            this.offlineQueue = [];
            this.pendingEvents = remaining.concat(this.pendingEvents);
            await this.resolveConflict(remaining);
            return;
          }

          this.lastEventId = result.lastEventId;
          writeLastEventId(this.lastEventId);
        } catch (error) {
          console.error("Failed to process offline queue:", error);
          // Keep remaining items in queue
          this.offlineQueue = this.offlineQueue.slice(i);
          return;
        }
      }

      this.offlineQueue = [];
      this.lastSaveTime = Date.now();
      console.log("✓ Offline queue processed");
    }

    clearTimers() {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      if (this.maxWaitTimer) {
        clearTimeout(this.maxWaitTimer);
        this.maxWaitTimer = null;
      }
    }

    updateUI(state) {
      updateSaveStatus(state, {
        isDirty: this.isDirty,
        lastSaveTime: this.lastSaveTime,
        isOnline: this.isOnline,
        queuedSaves: this.offlineQueue.length,
      });
    }

    // FIX: manualSave's no-pending-events path now runs inside saveMutex,
    // preventing a concurrent performSave from racing with sendSnapshot
    async manualSave() {
      if (this.pendingEvents.length === 0) {
        // No pending events — send full snapshot
        this.clearTimers();
        return this.saveMutex.runExclusive(async () => {
          try {
            this.updateUI("saving");
            const result = await this.sendSnapshot();
            this.lastEventId = result.lastEventId;
            writeLastEventId(this.lastEventId);
            this.updateUI("saved");
          } catch (error) {
            console.error("Manual save failed:", error);
            this.updateUI("error");
          }
        });
      }
      this.clearTimers();
      await this.performSave("manual");
    }

    reset() {
      this.pendingEvents = [];
      this.clearTimers();
      this.offlineQueue = [];
      this.retryCount = 0;
    }
  }

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

  /**
   * Read the watermark out of an API response.
   *
   * `apiRequest` returns null for a 404 (the hyperbook is not registered with
   * this cloud). Reading `.lastEventId` off it threw a TypeError that the save
   * loop mistook for a transient failure and retried forever.
   */
  function requireEventId(data) {
    if (!data || typeof data.lastEventId !== "number") {
      const err = new Error(
        "Cloud did not return an event id — is this hyperbook registered?",
      );
      err.status = 404;
      throw err;
    }
    return data.lastEventId;
  }

  /**
   * Replay events against the local Dexie database.
   *
   * Used when merging after a conflict: the server replays the same events on
   * its snapshot, so applying them locally keeps both sides identical. Hooks
   * are suppressed so the replay does not re-enqueue the events it applies.
   */
  async function applyEventsLocally(events) {
    if (!events || events.length === 0) return;

    const wasLoading = isLoadingFromCloud;
    isLoadingFromCloud = true;

    try {
      for (const event of events) {
        const table = hyperbook.store.db.table(event.table);
        if (!table) continue;

        try {
          if (event.op === "create") {
            await table.put(event.data);
          } else if (event.op === "update") {
            await table.update(event.primKey, event.data);
          } else if (event.op === "delete") {
            await table.delete(event.primKey);
          }
        } catch (error) {
          console.error(
            `Failed to replay ${event.op} on ${event.table}:`,
            error,
          );
        }
      }
    } finally {
      isLoadingFromCloud = wasLoading;
    }
  }

  /** The Bearer token of a book hosted elsewhere; null for hosted books. */
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

  function clearAuthToken() {
    localStorage.removeItem(`${AUTH_TOKEN_KEY}:${bookKey()}`);
    localStorage.removeItem(`${AUTH_USER_KEY}:${bookKey()}`);
    clearLastEventIds();
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

  function requestHeaders(extra) {
    const headers = { "Content-Type": "application/json", ...extra };
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  /**
   * Make API request to cloud
   */
  async function apiRequest(endpoint, options = {}) {
    if (!HYPERBOOK_CLOUD) return null;

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: requestHeaders(options.headers),
        credentials: SAME_ORIGIN ? "same-origin" : "omit",
      });

      // Only 401 means the session is gone. A 403 is a refused action (such
      // as saving in a read-only view) and must not log anyone out.
      if (response.status === 401 && !options.allowUnauthorized) {
        clearAuthToken();
        showLogin();
        const err = new Error("Authentication required");
        err.status = 401;
        throw err;
      }

      if (response.status === 404) {
        return null;
      }

      const data = await response.json();

      if (!response.ok) {
        const err = new Error(data.error || "Request failed");
        err.status = response.status;
        throw err;
      }

      return data;
    } catch (error) {
      if (!error.status) {
        console.error("Cloud API error:", error);
      }
      throw error;
    }
  }

  /**
   * Login to cloud
   */
  async function hyperbookLogin(username, password) {
    if (!HYPERBOOK_CLOUD) {
      throw new Error("Cloud not configured");
    }

    try {
      const sharedDevice = !!document.getElementById("user-shared-device")?.checked;
      const data = await apiRequest("/login", {
        method: "POST",
        allowUnauthorized: true,
        body: JSON.stringify({ username, password, sharedDevice, token: !SAME_ORIGIN }),
      });

      setAuthUser({ username: data.user.username, readonly: false }, data.token);

      // Load store data after login
      await loadFromCloud();

      // Reload so components pick up the imported state
      window.location.reload();

      return data.user;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout from cloud
   */
  function hyperbookLogout() {
    // Ends the session on the server too; for a hosted book that is the only
    // way to remove the HttpOnly cookie.
    if (HYPERBOOK_CLOUD) {
      fetch(`${API_BASE}/logout`, {
        method: "POST",
        headers: requestHeaders(),
        credentials: SAME_ORIGIN ? "same-origin" : "omit",
        body: "{}",
      }).catch(() => {});
    }
    clearAuthToken();
    updateUserUI(null);
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
    clearAuthToken();
    return false;
  }

  /** Completes a hand-off read from the address (see readHandoff). */
  async function completeHandoff() {
    if (!pendingHandoff) return false;
    const { kind, value } = pendingHandoff;
    pendingHandoff = null;
    if (kind === "impersonate") {
      clearAuthToken();
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
   * Load store data from cloud
   */
  async function loadFromCloud() {
    if (!HYPERBOOK_CLOUD || !isLoggedIn()) return;

    isLoadingFromCloud = true;

    try {
      const data = await apiRequest("/store");

      if (data && data.snapshot) {
        const storeData = data.snapshot.data || data.snapshot;
        const { hyperbook: hb } = storeData;

        if (hb) {
          const blob = new Blob([JSON.stringify(hb)], {
            type: "application/json",
          });
          // The payload is rows; the local Dexie schema is what defines the
          // database. Without these the import throws and the load silently
          // restores nothing:
          //  - the server's event-only reconstruction carries a placeholder
          //    databaseVersion, which never matches the store's version;
          //  - a snapshot written by an older hyperbook can name a table this
          //    build no longer has.
          await hyperbook.store.db.import(blob, {
            clearTablesBeforeImport: true,
            acceptVersionDiff: true,
            acceptMissingTables: true,
          });
        }
        console.log("✓ Store loaded from cloud");
      }

      // Track the server's watermark, also when nothing was saved yet.
      if (data && typeof data.lastEventId === "number") {
        writeLastEventId(data.lastEventId);
        if (syncManager) {
          syncManager.lastEventId = data.lastEventId;
        }
      }
    } catch (error) {
      if (error.message !== "No store data found") {
        console.error("Failed to load from cloud:", error);
      }
    } finally {
      isLoadingFromCloud = false;
    }
  }

  /**
   * Initialize cloud integration
   */
  async function init() {
    if (!HYPERBOOK_CLOUD) return;
    // Nothing may be recorded as a change before we know who is logged in.
    isLoadingFromCloud = true;
    try {
      await start();
    } finally {
      isLoadingFromCloud = false;
    }
  }

  async function start() {

    // A QR code or a teacher's "view as student" brought us here: log in,
    // load that state, and reload so the elements show it.
    if (pendingHandoff) {
      if (await completeHandoff()) {
        await loadFromCloud();
        window.location.reload();
        return;
      }
    } else if (SAME_ORIGIN || getAuthToken()) {
      // The cookie (hosted books) is invisible to scripts, so ask who is
      // logged in; for a token this also notices one that expired.
      await refreshSession();
      updateUserUI(getAuthUser());
      showImpersonationBanner();
    }

    // Load from cloud if authenticated
    if (isLoggedIn()) {
      try {
        await loadFromCloud();

        // Show readonly indicator if in impersonation mode
        if (isReadOnlyMode()) {
          updateSaveStatus("readonly");
        }
      } catch (error) {
        console.error("Initial cloud load failed:", error);
      }
    }

    if (isLoggedIn() && !isReadOnlyMode()) {
      syncManager = new SyncManager({
        debounceDelay: 2000,
        maxWaitTime: 10000,
        minSaveInterval: 1000,
      });

      // Suppress events from directive initialization (e.g., restoring collapsible
      // state triggers Dexie writes via toggle events after hooks are registered).
      isLoadingFromCloud = true;

      // Hook Dexie tables to capture granular events (skip ephemeral tables)
      hyperbook.store.db.tables.forEach((table) => {
        if (EPHEMERAL_TABLES.indexOf(table.name) !== -1) return;

        // The primary-key source string ("id", "path", "++id", "[a+b]").
        // Sent with every event so the server can replay onto a table it has
        // never seen in a snapshot without having to guess the key field.
        const schema = table.schema?.primKey?.src ?? null;

        table.hook("creating", function (primKey, obj) {
          syncManager.addEvent({
            table: table.name,
            schema: schema,
            op: "create",
            primKey: primKey,
            data: obj,
          });
        });

        table.hook("updating", function (modifications, primKey) {
          syncManager.addEvent({
            table: table.name,
            schema: schema,
            op: "update",
            primKey: primKey,
            data: modifications,
          });
        });

        table.hook("deleting", function (primKey) {
          syncManager.addEvent({
            table: table.name,
            schema: schema,
            op: "delete",
            primKey: primKey,
            data: null,
          });
        });
      });

      // Allow directive initialization to settle before accepting sync events
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
      isLoadingFromCloud = false;
    }
  }

  // ===== Cloud UI Functions =====
  const updateUserIconState = (state) => {
    const icon = document.querySelector(".user-icon");
    if (!icon) return;
    icon.setAttribute("data-state", state);
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
    return hyperbook.i18n.get(
      "user-saved-hours-ago",
      { hours: String(hours) },
      `${hours} h ago`,
    );
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
      text: () => hyperbook.i18n.get("user-unsaved", {}, "Unsaved changes"),
    },
    saving: {
      icon: "syncing",
      text: () => hyperbook.i18n.get("user-saving", {}, "Saving..."),
    },
    saved: {
      icon: "synced",
      text: (meta) => {
        const age = describeAge(meta.lastSaveTime);
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
    "offline-queued": {
      icon: "pending",
      // Say how much is waiting: "Saved locally" alone reads as "all done".
      text: (meta) => {
        const base = hyperbook.i18n.get(
          "user-offline-queued",
          {},
          "Saved locally",
        );
        if (!meta.queuedSaves) return base;
        return `${base} (${hyperbook.i18n.get(
          "user-queued-count",
          { count: String(meta.queuedSaves) },
          `${meta.queuedSaves} waiting to sync`,
        )})`;
      },
    },
    readonly: {
      icon: "readonly",
      text: () => hyperbook.i18n.get("user-readonly", {}, "Read-Only Mode"),
    },
  };

  /**
   * Explain a merge, then reload.
   *
   * A conflict used to reload the page the instant it resolved: the reader's
   * content changed under them, mid-sentence, with nothing said about why.
   * Reloading is still necessary — directives read the store once at startup,
   * so the DOM shows pre-merge state — but it should not be a surprise.
   */
  const announceMergeAndReload = () => {
    mergeNoticeShown = true;
    const reload = () => window.location.reload();

    showSyncNotice({
      tone: "info",
      message: hyperbook.i18n.get(
        "user-notice-merged",
        {},
        "Merged with changes from another session. Reloading to show them...",
      ),
      action: {
        label: hyperbook.i18n.get("user-notice-reload", {}, "Reload now"),
        onClick: reload,
      },
    });

    setTimeout(reload, MERGE_RELOAD_DELAY);
  };

  const NOTICE_ID = "cloud-sync-notice";

  /**
   * An ambient notice for sync states the reader can do something about.
   *
   * The status line lives inside the user drawer, so until the reader opens it
   * the toolbar badge is the only signal that anything is wrong — easy to miss
   * for exactly the states that matter (offline, failing, merged). This surfaces
   * those, and only those: a toast on every successful save would be noise.
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

  /** The states worth interrupting for, and what the notice says about them. */
  const noticeFor = (status, metadata) => {
    if (status === "error") {
      return {
        tone: "error",
        message: hyperbook.i18n.get(
          "user-notice-error",
          {},
          "Could not save to the cloud. Your changes are still on this device.",
        ),
        action: {
          label: hyperbook.i18n.get("user-notice-retry", {}, "Retry"),
          onClick: () => syncManager && syncManager.manualSave(),
        },
      };
    }

    if (status === "offline" || status === "offline-queued") {
      const base = hyperbook.i18n.get(
        "user-notice-offline",
        {},
        "Offline. Changes are kept on this device and sync when you reconnect.",
      );
      const queued = metadata.queuedSaves
        ? ` (${hyperbook.i18n.get(
            "user-queued-count",
            { count: String(metadata.queuedSaves) },
            `${metadata.queuedSaves} waiting to sync`,
          )})`
        : "";
      return { tone: "warning", message: base + queued };
    }

    return null;
  };

  const updateSaveStatus = (status, metadata = {}) => {
    const state = SAVE_STATES[status];
    if (!state) return;

    const label = state.text(metadata);

    // The icon is updated first and unconditionally. It used to sit behind the
    // status-element guard below, so a shell rendered without the user drawer
    // left the toolbar icon frozen on whatever it showed last.
    updateUserIconState(state.icon);

    // The icon is the only sync indicator most readers ever see, so it needs an
    // accessible name that actually tracks the state.
    const toggle = document.getElementById("user-toggle");
    if (toggle) {
      toggle.setAttribute("title", label);
      toggle.setAttribute("aria-label", label);
    }

    // The merge notice owns the notice slot until it reloads; a save finishing
    // in the meantime must not clear the explanation out from under the reader.
    if (!mergeNoticeShown) {
      const notice = noticeFor(status, metadata);
      if (notice) {
        showSyncNotice(notice);
      } else {
        dismissSyncNotice();
      }
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
      const user = getAuthUser();
      updateUserUI(user);
    }
  };

  const login = async () => {
    const username = document.getElementById("user-username").value;
    const password = document.getElementById("user-password").value;
    const errorEl = document.getElementById("user-login-error");

    if (!username || !password) {
      errorEl.textContent = hyperbook.i18n.get(
        "user-login-required",
        {},
        "Username and password required",
      );
      return;
    }

    try {
      const user = await hyperbookLogin(username, password);
      updateUserUI(user);
      errorEl.textContent = "";
    } catch (error) {
      errorEl.textContent =
        error.message || hyperbook.i18n.get("user-login-failed", {}, "Login failed");
    }
  };

  const logout = () => {
    if (
      confirm(
        hyperbook.i18n.get("user-logout-confirm", {}, "Are you sure you want to logout?"),
      )
    ) {
      hyperbookLogout();
      updateUserUI(null);

      const drawer = document.getElementById("user-drawer");
      if (drawer) {
        drawer.removeAttribute("open");
      }
    }
  };

  // Initialize user UI on load
  document.addEventListener("DOMContentLoaded", () => {
    const user = getAuthUser();
    if (user) {
      updateUserUI(user);
    }

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
      document.createTextNode(
        `${hyperbook.i18n.get("user-impersonating", {}, "Impersonating")}: `,
      ),
    );
    const name = document.createElement("strong");
    name.textContent = user ? user.username : "";
    label.appendChild(name);
    label.appendChild(
      document.createTextNode(
        ` — ${hyperbook.i18n.get("user-readonly", {}, "Read-Only Mode")}`,
      ),
    );

    const exit = document.createElement("a");
    exit.href = "#";
    exit.id = "exit-impersonation";
    exit.textContent = hyperbook.i18n.get(
      "user-exit-impersonation",
      {},
      "Exit Impersonation",
    );

    banner.appendChild(label);
    banner.appendChild(exit);
    document.body.prepend(banner);

    document
      .getElementById("exit-impersonation")
      .addEventListener("click", (e) => {
        e.preventDefault();
        hyperbookLogout();
        window.close();
        window.location.reload();
      });
  }

  init();

  return {
    save: () => syncManager?.manualSave(),
    sendSnapshot: async () => {
      if (!syncManager || !isLoggedIn() || isReadOnlyMode()) return;
      syncManager.pendingEvents = [];
      syncManager.clearTimers();
      const result = await syncManager.sendSnapshot();
      syncManager.lastEventId = result.lastEventId;
      writeLastEventId(result.lastEventId);
    },
    userToggle,
    login,
    logout,
    /**
     * The live SyncManager, or null when sync is not active. This asset ships
     * as a plain script with no module boundary, so this accessor is how the
     * test suite reaches the queue, watermark and offline logic.
     */
    _internal: () => ({
      syncManager,
      applyEventsLocally,
      readLastEventId,
      isLoadingFromCloud,
    }),
  };
})();
