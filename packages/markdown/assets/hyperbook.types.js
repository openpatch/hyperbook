/**
 * @file Type definitions for the hyperbook global namespace.
 * This file is NOT loaded in the browser. It exists solely for IDE support
 * and JSDoc cross-referencing between scripts.
 *
 * Usage: Add the following to the top of any script that references
 * other hyperbook modules:
 *   /// <reference path="../hyperbook.types.js" />
 */

/**
 * @namespace hyperbook
 * @description Global namespace for all hyperbook client-side modules.
 * Initialized by i18n.js (first script to load) with
 * `window.hyperbook = window.hyperbook || {}`.
 */

/**
 * @typedef {Object} HyperbookI18n
 * @property {(key: string, values?: Record<string, string>) => string} get
 *   Returns the translated string for the given key, substituting `{{placeholder}}`
 *   patterns with values from the `values` object. Falls back to the key itself
 *   if no translation is found.
 */

/**
 * @typedef {Object} HyperbookStore
 * @property {import("dexie").Dexie} db - The underlying Dexie database instance.
 * @property {import("dexie").Table} currentState - Ephemeral UI state (mouse, scroll, window size).
 * @property {import("dexie").Table} collapsibles - Persisted open/close state for collapsible elements.
 * @property {import("dexie").Table} abcMusic - ABC music editor tunes.
 * @property {import("dexie").Table} audio - Audio playback positions.
 * @property {import("dexie").Table} bookmarks - User bookmarks (path + label).
 * @property {import("dexie").Table} p5 - p5.js sketches.
 * @property {import("dexie").Table} protect - Password hashes for protected content.
 * @property {import("dexie").Table} pyide - Python IDE scripts.
 * @property {import("dexie").Table} slideshow - Active slide indices.
 * @property {import("dexie").Table} tabs - Active tab selections.
 * @property {import("dexie").Table} excalidraw - Excalidraw drawing state.
 * @property {import("dexie").Table} webide - Web IDE editor contents (HTML/CSS/JS).
 * @property {import("dexie").Table} h5p - H5P user data.
 * @property {import("dexie").Table} geogebra - GeoGebra applet state.
 * @property {import("dexie").Table} learningmap - Learning map node positions and zoom.
 * @property {import("dexie").Table} textinput - Text input field values.
 * @property {import("dexie").Table} custom - Custom directive payload storage.
 * @property {import("dexie").Table} onlineide - Online IDE scripts.
 * @property {import("dexie").Table} sqlideScripts - SQL IDE scripts.
 * @property {import("dexie").Table} sqlideDatabases - SQL IDE databases.
 * @property {import("dexie").Table} multievent - Multi-event state.
 * @property {import("dexie").Table} typst - Typst editor code.
 * @property {() => Promise<void>} export - Export all store data as a JSON download.
 * @property {() => Promise<void>} reset - Clear all store data after user confirmation.
 * @property {() => Promise<void>} import - Import store data from a JSON file.
 */

/**
 * @typedef {Object} HyperbookCloud
 * @property {() => Promise<void>} save - Manually trigger a save to the cloud.
 * @property {() => Promise<void>} sendSnapshot - Send a full snapshot to the cloud.
 * @property {() => void} userToggle - Toggle the user login/info drawer.
 * @property {() => Promise<void>} login - Log in with username and password from the form.
 * @property {() => void} logout - Log out and clear auth state.
 */

/**
 * @typedef {Object} HyperbookAbc
 * @property {(root: HTMLElement) => void} init - Initialize ABC music elements.
 */

/**
 * @typedef {Object} HyperbookArchive
 * @property {() => void} init - Initialize archive download status indicators.
 */

/**
 * @typedef {Object} HyperbookAudio
 * @property {(id: string) => void} togglePlayPause - Toggle play/pause for an audio element.
 */

/**
 * @typedef {Object} HyperbookBookmarks
 * @property {(root?: Document) => void} update - Refresh the bookmarks list in the DOM.
 */

/**
 * @typedef {Object} HyperbookDownload
 * @property {(root: HTMLElement) => void} init - Initialize download status indicators.
 */

/**
 * @typedef {Object} HyperbookExcalidraw
 */

/**
 * @typedef {Object} HyperbookGeogebra
 * @property {(root: HTMLElement) => void} init - Initialize GeoGebra applets.
 */

/**
 * @typedef {Object} HyperbookH5p
 * @property {(root: HTMLElement) => Promise<void>} init - Initialize H5P elements.
 * @property {(id: string) => void} save - Save H5P user data for an element.
 */

/**
 * @typedef {Object} HyperbookLearningmap
 * @property {(root: HTMLElement) => void} init - Initialize learning map elements.
 */

/**
 * @typedef {Object} HyperbookMermaid
 * @property {() => void} init - Initialize mermaid diagrams.
 */

/**
 * @typedef {Object} HyperbookOnlineide
 * @property {(el: HTMLElement) => void} openFullscreen - Open the online IDE in fullscreen.
 */

/**
 * @typedef {Object} HyperbookP5
 */

/**
 * @typedef {Object} HyperbookProtect
 * @property {(root: HTMLElement) => void} init - Initialize protected content elements.
 */

/**
 * @typedef {Object} HyperbookPython
 * @property {(root: HTMLElement) => void} init - Initialize Python IDE elements.
 */

/**
 * @typedef {Object} HyperbookScratchblock
 * @property {() => void} init - Render all scratch blocks on the page.
 */

/**
 * @typedef {Object} HyperbookSlideshow
 * @property {(id: string) => void} update - Update slideshow state from store.
 * @property {(id: string, steps: number) => void} moveBy - Move the slideshow by a number of steps.
 * @property {(id: string, index: number) => void} setActive - Set the active slide by index.
 * @property {(root: HTMLElement) => void} init - Initialize slideshows within a root element.
 */

/**
 * @typedef {Object} HyperbookSqlide
 * @property {(el: HTMLElement) => void} openFullscreen - Open the SQL IDE in fullscreen.
 */

/**
 * @typedef {Object} HyperbookTabs
 * @property {(tabsId: string, tabId: string) => void} selectTab - Select a tab by ID.
 * @property {(root: HTMLElement) => void} init - Initialize tab elements.
 */

/**
 * @typedef {Object} HyperbookTextinput
 * @property {(root: HTMLElement) => void} init - Initialize text input elements.
 */

/**
 * @typedef {Object} HyperbookWebide
 */

/**
 * Global hyperbook namespace available on `window.hyperbook`.
 *
 * @type {{
 *   i18n: HyperbookI18n,
 *   store: HyperbookStore,
 *   cloud?: HyperbookCloud,
 *   toggleLightbox: (el: HTMLElement) => void,
 *   toggleBookmark: (key: string, label: string) => void,
 *   navToggle: () => void,
 *   tocToggle: () => void,
 *   searchToggle: () => void,
 *   search: () => void,
 *   qrcodeOpen: () => void,
 *   qrcodeClose: () => void,
 *   shareOpen: () => void,
 *   shareClose: () => void,
 *   shareUpdatePreview: () => void,
 *   shareCopyUrl: () => void,
 *   init: (root: HTMLElement) => void,
 *   abc?: HyperbookAbc,
 *   archive?: HyperbookArchive,
 *   audio?: HyperbookAudio,
 *   bookmarks?: HyperbookBookmarks,
 *   download?: HyperbookDownload,
 *   excalidraw?: HyperbookExcalidraw,
 *   geogebra?: HyperbookGeogebra,
 *   h5p?: HyperbookH5p,
 *   learningmap?: HyperbookLearningmap,
 *   mermaid?: HyperbookMermaid,
 *   onlineide?: HyperbookOnlineide,
 *   p5?: HyperbookP5,
 *   protect?: HyperbookProtect,
 *   python?: HyperbookPython,
 *   scratchblock?: HyperbookScratchblock,
 *   slideshow?: HyperbookSlideshow,
 *   sqlide?: HyperbookSqlide,
 *   tabs?: HyperbookTabs,
 *   textinput?: HyperbookTextinput,
 *   webide?: HyperbookWebide,
 * }}
 */
var hyperbook;
