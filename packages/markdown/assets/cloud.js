window.hyperbook = window.hyperbook || {};
window.hyperbook.cloud = (function () {
  // ===== Cloud Integration =====
  const AUTH_TOKEN_KEY = "hyperbook_auth_token";
  const AUTH_USER_KEY = "hyperbook_auth_user";
  let isLoadingFromCloud = false;

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

      this.isDirty = false;
      this.lastSaveTime = 0;
      this.lastChangeTime = 0;
      this.debounceTimer = null;
      this.maxWaitTimer = null;
      this.saveInProgress = false;
      this.saveMutex = new Mutex();
      this.retryCount = 0;

      this.dirtyStores = new Set();

      this.offlineQueue = [];
      this.isOnline = navigator.onLine;

      // Snapshots for external DB polling
      this.externalDBs = options.externalDBs || [];
      this.externalSnapshots = {};
      this.pollInterval = options.pollInterval || 5000;
      this.pollTimer = null;

      this.setupEventListeners();
    }

    /**
     * Get a fingerprint of an external DB by hashing all row data.
     */
    _snapshotExternalDB(dbName) {
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

          const parts = [];
          const tx = db.transaction(storeNames, "readonly");
          let pending = storeNames.length;
          storeNames.forEach((name) => {
            const rows = [];
            const cursorReq = tx.objectStore(name).openCursor();
            cursorReq.onsuccess = (e) => {
              const cursor = e.target.result;
              if (cursor) {
                rows.push(JSON.stringify(cursor.value));
                cursor.continue();
              } else {
                parts.push(name + ":" + rows.join(","));
                pending--;
                if (pending === 0) {
                  db.close();
                  resolve(parts.join("|"));
                }
              }
            };
            cursorReq.onerror = () => {
              pending--;
              if (pending === 0) {
                db.close();
                resolve(parts.join("|"));
              }
            };
          });
        };
      });
    }

    /**
     * Take initial snapshots and start polling external DBs for changes.
     */
    async startPolling() {
      for (const dbName of this.externalDBs) {
        this.externalSnapshots[dbName] = await this._snapshotExternalDB(dbName);
      }
      this.pollTimer = setInterval(
        () => this._pollExternalDBs(),
        this.pollInterval,
      );
    }

    /**
     * Stop polling external DBs.
     */
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    }

    async _pollExternalDBs() {
      if (isLoadingFromCloud || this.saveInProgress) return;
      for (const dbName of this.externalDBs) {
        const current = await this._snapshotExternalDB(dbName);
        const prev = this.externalSnapshots[dbName];

        if (current !== prev) {
          this.externalSnapshots[dbName] = current;
          this.markDirty(dbName);
        }
      }
    }

    markDirty(storeName = null) {
      if (isLoadingFromCloud || isReadOnlyMode()) return;
      if (storeName) {
        this.dirtyStores.add(storeName);
      }
      this.isDirty = true;
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
      if (!HYPERBOOK_CLOUD || !getAuthToken()) return;
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
        this.updateUI("saving");

        try {
          const dataToSave = await this.exportStores();

          if (!this.isOnline) {
            this.offlineQueue.push({
              data: dataToSave,
              timestamp: Date.now(),
            });
            this.updateUI("offline-queued");
            return;
          }

          await apiRequest(`/api/store/${HYPERBOOK_CLOUD.id}`, {
            method: "POST",
            body: JSON.stringify({ data: dataToSave }),
          });

          this.isDirty = false;
          this.dirtyStores.clear();
          this.lastSaveTime = Date.now();
          this.retryCount = 0;
          this.updateUI("saved");
          console.log(`✓ Saved (${reason})`);
        } catch (error) {
          console.error("Save failed:", error);
          this.updateUI("error");
          this.scheduleRetry();
        } finally {
          this.saveInProgress = false;
        }
      });
    }

    async exportStores() {
      const hyperbookExport = await store.export({ prettyJson: false });
      const sqlIdeExport = await exportExternalDB("SQL-IDE");
      const learnJExport = await exportExternalDB("LearnJ");
      return {
        version: 1,
        origin: window.location.origin,
        data: {
          hyperbook: JSON.parse(await hyperbookExport.text()),
          sqlIde: sqlIdeExport || {},
          learnJ: learnJExport || {},
        },
      };
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
        if (this.isDirty) {
          this.performSave("unload");
          e.preventDefault();
          e.returnValue = "";
        }
      });

      document.addEventListener("visibilitychange", () => {
        if (document.hidden && this.isDirty) {
          this.performSave("visibility-change");
        }
      });
    }

    async processOfflineQueue() {
      if (this.offlineQueue.length === 0) return;

      console.log(`Processing ${this.offlineQueue.length} queued saves...`);
      this.offlineQueue.sort((a, b) => a.timestamp - b.timestamp);

      // Only send the latest queued save
      const latest = this.offlineQueue[this.offlineQueue.length - 1];
      try {
        await apiRequest(`/api/store/${HYPERBOOK_CLOUD.id}`, {
          method: "POST",
          body: JSON.stringify({ data: latest.data }),
        });
        this.offlineQueue = [];
        this.lastSaveTime = Date.now();
        console.log("✓ Offline queue processed");
      } catch (error) {
        console.error("Failed to process offline queue:", error);
      }
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

    async manualSave() {
      this.isDirty = true;
      this.clearTimers();
      await this.performSave("manual");
    }

    reset() {
      this.isDirty = false;
      this.dirtyStores.clear();
      this.clearTimers();
      this.stopPolling();
      this.offlineQueue = [];
      this.retryCount = 0;
    }
  }

  // Check URL hash for impersonation token (cross-domain handoff)
  let isImpersonationLoad = false;
  (function checkImpersonationHash() {
    if (!HYPERBOOK_CLOUD) return;
    const hash = window.location.hash;
    const match = hash.match(/^#impersonate=(.+)$/);
    if (match) {
      const token = match[1];
      try {
        // Validate token format before decoding
        if (token.split(".").length !== 3) {
          throw new Error("Invalid token format");
        }
        const payload = JSON.parse(atob(token.split(".")[1]));
        localStorage.setItem(AUTH_TOKEN_KEY, token);
        localStorage.setItem(
          AUTH_USER_KEY,
          JSON.stringify({
            id: payload.id,
            username: payload.username,
          }),
        );
        isImpersonationLoad = true;
        // Clean the hash from URL without triggering navigation
        history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
      } catch (e) {
        console.error("Invalid impersonation token in URL:", e);
      }
    }
  })();

  /**
   * Get current auth token
   */
  function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  }

  /**
   * Set auth token
   */
  function setAuthToken(token, user) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    }
  }

  /**
   * Clear auth token
   */
  function clearAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  }

  /**
   * Get current user
   */
  function getAuthUser() {
    const userJson = localStorage.getItem(AUTH_USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  }

  /**
   * Check if current session is read-only (impersonation mode)
   */
  function isReadOnlyMode() {
    const token = getAuthToken();
    if (!token) return false;

    try {
      // Validate token format before decoding
      if (token.split(".").length !== 3) {
        return false;
      }
      // Decode JWT without verification (just to check readonly flag)
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.readonly === true;
    } catch (error) {
      console.error("Error checking read-only mode:", error);
      return false;
    }
  }

  /**
   * Make API request to cloud
   */
  async function apiRequest(endpoint, options = {}) {
    if (!HYPERBOOK_CLOUD) return null;

    const token = getAuthToken();
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${HYPERBOOK_CLOUD.url}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 401 || response.status === 403) {
        // Token expired or invalid
        clearAuthToken();
        showLogin();
        throw new Error("Authentication required");
      }

      if (response.status === 404) {
        return null;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      return data;
    } catch (error) {
      console.error("Cloud API error:", error);
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
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });

      setAuthToken(data.token, data.user);

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
    clearAuthToken();
    updateUserUI(null);
  }

  /**
   * Load store data from cloud
   */
  async function loadFromCloud() {
    if (!HYPERBOOK_CLOUD || !getAuthToken()) return;

    isLoadingFromCloud = true;

    try {
      const data = await apiRequest(`/api/store/${HYPERBOOK_CLOUD.id}`);

      if (data && data.data) {
        // Import data into local stores
        const storeData = data.data.data || data.data;
        const { hyperbook, sqlIde, learnJ } = storeData;

        if (hyperbook) {
          const blob = new Blob([JSON.stringify(hyperbook)], {
            type: "application/json",
          });
          await store.import(blob, { clearTablesBeforeImport: true });
        }

        if (sqlIde) {
          await importExternalDB("SQL-IDE", sqlIde);
        }

        if (learnJ) {
          await importExternalDB("LearnJ", learnJ);
        }

        console.log("✓ Store loaded from cloud");
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
  async function initCloudIntegration() {
    // Load from cloud if authenticated
    if (HYPERBOOK_CLOUD && getAuthToken()) {
      try {
        await loadFromCloud();

        // Reload page after impersonation data is imported so components pick up the new state
        if (isImpersonationLoad) {
          window.location.reload();
          return;
        }

        // Show readonly indicator if in impersonation mode
        if (isReadOnlyMode()) {
          updateSaveStatus("readonly");
        }
      } catch (error) {
        console.error("Initial cloud load failed:", error);
      }
    }

    // Initialize SyncManager for cloud syncing
    let syncManager = null;
    if (HYPERBOOK_CLOUD && getAuthToken() && !isReadOnlyMode()) {
      syncManager = new SyncManager({
        debounceDelay: 2000,
        maxWaitTime: 10000,
        minSaveInterval: 1000,
        externalDBs: ["SQL-IDE", "LearnJ"],
        pollInterval: 5000,
      });

      // Hook Dexie tables to track changes (skip currentState — ephemeral UI data)
      store.tables.forEach((table) => {
        if (table.name === "currentState") return;
        table.hook("creating", () => syncManager.markDirty(table.name));
        table.hook("updating", () => syncManager.markDirty(table.name));
        table.hook("deleting", () => syncManager.markDirty(table.name));
      });

      // Start polling external DBs for changes
      syncManager.startPolling();

      window.hyperbookManualSave = () => syncManager.manualSave();
    }
  }

  // ===== Cloud UI Functions =====
  const updateUserIconState = (state) => {
    const icon = document.querySelector('.user-icon');
    if (!icon) return;
    icon.setAttribute('data-state', state);
  };

  const updateUserUI = (user) => {
    const loginForm = document.getElementById('user-login-form');
    const userInfo = document.getElementById('user-info');

    if (!loginForm || !userInfo) return;

    if (user) {
      loginForm.classList.add('hidden');
      userInfo.classList.remove('hidden');
      document.getElementById('user-display-name').textContent = user.username;
      updateUserIconState('logged-in');
    } else {
      loginForm.classList.remove('hidden');
      userInfo.classList.add('hidden');
      const passwordField = document.getElementById('user-password');
      if (passwordField) passwordField.value = '';
      updateUserIconState('not-logged-in');
    }
  };

  const updateSaveStatus = (status, metadata = {}) => {
    const statusEl = document.getElementById('user-save-status');
    if (!statusEl) return;

    statusEl.className = status;

    if (status === 'unsaved') {
      statusEl.textContent = i18n.get('user-unsaved', {}, 'Unsaved changes');
      updateUserIconState('logged-in');
    } else if (status === 'saving') {
      statusEl.textContent = i18n.get('user-saving', {}, 'Saving...');
      updateUserIconState('syncing');
    } else if (status === 'saved') {
      statusEl.textContent = i18n.get('user-saved', {}, 'Saved');
      updateUserIconState('synced');
    } else if (status === 'error') {
      statusEl.textContent = i18n.get('user-save-error', {}, 'Save Error');
      updateUserIconState('unsynced');
    } else if (status === 'offline') {
      statusEl.textContent = i18n.get('user-offline', {}, 'Offline');
      updateUserIconState('unsynced');
    } else if (status === 'offline-queued') {
      statusEl.textContent = i18n.get('user-offline-queued', {}, 'Saved locally');
      updateUserIconState('logged-in');
    } else if (status === 'readonly') {
      statusEl.textContent = i18n.get('user-readonly', {}, 'Read-Only Mode');
      statusEl.className = 'readonly';
      updateUserIconState('synced');
    }
  };

  const showLogin = () => {
    const drawer = document.getElementById('user-drawer');
    if (drawer && !drawer.hasAttribute('open')) {
      drawer.setAttribute('open', '');
      updateUserUI(null);
    }
  };

  const userToggle = () => {
    const drawer = document.getElementById('user-drawer');
    if (drawer) {
      drawer.toggleAttribute('open');
      const user = getAuthUser();
      updateUserUI(user);
    }
  };

  const doLogin = async () => {
    const username = document.getElementById('user-username').value;
    const password = document.getElementById('user-password').value;
    const errorEl = document.getElementById('user-login-error');

    if (!username || !password) {
      errorEl.textContent = i18n.get('user-login-required', {}, 'Username and password required');
      return;
    }

    try {
      const user = await hyperbookLogin(username, password);
      updateUserUI(user);
      errorEl.textContent = '';
    } catch (error) {
      errorEl.textContent = error.message || i18n.get('user-login-failed', {}, 'Login failed');
    }
  };

  const doLogout = () => {
    if (confirm(i18n.get('user-logout-confirm', {}, 'Are you sure you want to logout?'))) {
      hyperbookLogout();
      updateUserUI(null);

      const drawer = document.getElementById('user-drawer');
      if (drawer) {
        drawer.removeAttribute('open');
      }
    }
  };

  // Initialize user UI on load
  document.addEventListener('DOMContentLoaded', () => {
    const user = getAuthUser();
    if (user) {
      updateUserUI(user);
    }

    // Show impersonation banner if in readonly mode
    if (isReadOnlyMode()) {
      const banner = document.createElement('div');
      banner.id = 'impersonation-banner';
      banner.innerHTML = `
        <span>${i18n.get('user-impersonating', {}, 'Impersonating')}: <strong>${user ? user.username : ''}</strong> — ${i18n.get('user-readonly', {}, 'Read-Only Mode')}</span>
        <a href="#" id="exit-impersonation">${i18n.get('user-exit-impersonation', {}, 'Exit Impersonation')}</a>
      `;
      document.body.prepend(banner);

      document.getElementById('exit-impersonation').addEventListener('click', (e) => {
        e.preventDefault();
        hyperbookLogout();
        window.close();
        window.location.reload();
      });
    }
  });

  return {
    login: hyperbookLogin,
    logout: hyperbookLogout,
    getAuthUser,
    isReadOnlyMode,
    initCloudIntegration,
    updateUserUI,
    updateSaveStatus,
    showLogin,
    userToggle,
    doLogin,
    doLogout,
  }
})();
