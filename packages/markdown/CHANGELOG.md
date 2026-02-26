# @hyperbook/markdown

## 0.58.3

### Patch Changes

- [`146b7e2`](https://github.com/openpatch/hyperbook/commit/146b7e2bd3df8dbd66a835152f555e9ad45e90eb) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix global var hyperbook not found

## 0.58.2

### Patch Changes

- [`a0e379b`](https://github.com/openpatch/hyperbook/commit/a0e379bb0be20dd2c8e582d32b3481a463d48e6f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix typst not downloading the current code

## 0.58.1

### Patch Changes

- [`bd5620b`](https://github.com/openpatch/hyperbook/commit/bd5620bd54d51cd05759bb894a4624e5d1175854) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix dark mode and overflow for consent banners

## 0.58.0

### Minor Changes

- [`7aa3666`](https://github.com/openpatch/hyperbook/commit/7aa3666ffc93f22c496254c64dbf3ee2641a1c97) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add struktolab integration

## 0.57.0

### Minor Changes

- [`bb3a336`](https://github.com/openpatch/hyperbook/commit/bb3a3365f9b10d5f56e2e3c38b655ad5777f7618) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add consent banner to embeds and youtube

## 0.56.0

### Minor Changes

- [`b39a52a`](https://github.com/openpatch/hyperbook/commit/b39a52a0b1b1a37cb0b5b256ba7f43093e2ee946) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Standardize client-side scripts to use `hyperbook.*` namespace pattern.

  - All scripts now use `hyperbook.X = (function() { return {...} })()` IIFE pattern
  - Moved `var store` and `var i18n` globals under `hyperbook.store` and `hyperbook.i18n`
  - Split `client.js` into `bootstrap.js` (init logic) and `ui.js` (UI functions)
  - Grouped UI functions into sub-namespaces: `hyperbook.ui`, `hyperbook.qrcode`, `hyperbook.share`
  - All directives now auto-init with `DOMContentLoaded` and `MutationObserver`
  - Added JSDoc type definitions via `hyperbook.types.js` for IDE support
  - Resolved `hyperbook.download` naming collision (archive directive renamed to `hyperbook.archive`)

## 0.55.4

### Patch Changes

- [`d98c9ca`](https://github.com/openpatch/hyperbook/commit/d98c9cac95017c0bfa098929218bc94ff758a906) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Move to an event driven architecture for hyperbook cloud

- [`3d77fd8`](https://github.com/openpatch/hyperbook/commit/3d77fd83942ccb9e8fe7fae86b03689ee739bae0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - sqlide and onlineide now using the dexie store.

## 0.55.3

### Patch Changes

- [`0332c62`](https://github.com/openpatch/hyperbook/commit/0332c62c717900b73746a631d2293b946d80b44a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix processing of tabs and collapsibles

## 0.55.2

### Patch Changes

- [`74f520c`](https://github.com/openpatch/hyperbook/commit/74f520c92b5fda0eb72b536c7ba91b52bf0b97e9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix url path for relative links in tiles element.

## 0.55.1

### Patch Changes

- [`0d029e3`](https://github.com/openpatch/hyperbook/commit/0d029e3d4287e7054c25f40d42aadb4eb308f740) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug related to the new cloud feature.

## 0.55.0

### Minor Changes

- [`4b64ec3`](https://github.com/openpatch/hyperbook/commit/4b64ec3be33fcda363e5cc724adcfadfc3c42649) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add hyperbook cloud support.

## 0.54.0

### Minor Changes

- [`78a5ff3`](https://github.com/openpatch/hyperbook/commit/78a5ff37534742ee79f2f7422914d4a091a805f6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Use local files for online-ide and for sql-ide.

## 0.53.0

### Minor Changes

- [`2f3a35d`](https://github.com/openpatch/hyperbook/commit/2f3a35dd37cddc190b81ec8cfa3682aaba77a1d7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update default online-ide url to onlineide2.openpatch.org which uses the new compiler.

## 0.52.1

### Patch Changes

- [`75dfa0d`](https://github.com/openpatch/hyperbook/commit/75dfa0d202c1245ece7fb088e23047fdf31c6568) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix Typst directive issues:
  - Fix preview not updating when editor content changes
  - Fix UTF-8 encoding for umlauts and special characters in base64 decoding
  - Fix CSV/JSON/YAML/XML file loading by inlining assets as bytes with proper UTF-8 handling
  - Add assets preamble to all source files to support `#include` with assets

## 0.52.0

### Minor Changes

- [`25fabdf`](https://github.com/openpatch/hyperbook/commit/25fabdfe4a6af538f41041b233c3e5a02cf1b7f4) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Allow to load custom fonts in typst.

### Patch Changes

- [`f81de0c`](https://github.com/openpatch/hyperbook/commit/f81de0c24a93a7a126f5358b7f1ed94139e8ee4f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve code structure in typst client.js

## 0.51.0

### Minor Changes

- [`b28ca89`](https://github.com/openpatch/hyperbook/commit/b28ca894f26084fdf2e644e33d546efd7e55434f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Support loading other files aswell in typst.

## 0.50.1

### Patch Changes

- [`aca86a0`](https://github.com/openpatch/hyperbook/commit/aca86a0be14cc351a27ba998ac86e52dc9332a43) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix side-drawer flashing on refresh / first load

## 0.50.0

### Minor Changes

- [`291f477`](https://github.com/openpatch/hyperbook/commit/291f4772664aabaf5d5cd8a553ba1b1757855641) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Automatic loading of images and other assets in Typst documents.

## 0.49.0

### Minor Changes

- [`54963f2`](https://github.com/openpatch/hyperbook/commit/54963f2e022cb90de6c74d1d28b80e34b51cb2bd) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update pagelist directive to match exactly as default.

## 0.48.7

### Patch Changes

- [`3e9f9a9`](https://github.com/openpatch/hyperbook/commit/3e9f9a9a7b6dc48222ee10cb07ba4fa20fae5cb3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update all dependencies

## 0.48.6

### Patch Changes

- [`2298714`](https://github.com/openpatch/hyperbook/commit/22987149f801f5e1372ad0aaf89aea601172238f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix input width of multievent input

## 0.48.5

### Patch Changes

- [`1d4f6df`](https://github.com/openpatch/hyperbook/commit/1d4f6df7e35ebc54b56dee024249e969da3856fe) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Normalize line-height for code blocks

## 0.48.4

### Patch Changes

- [`f8d67df`](https://github.com/openpatch/hyperbook/commit/f8d67df980e25ed17c88d80d0ffb36ef71f0b633) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix empty pages show up in prev and next navigation

## 0.48.3

### Patch Changes

- [`503080e`](https://github.com/openpatch/hyperbook/commit/503080e0a8f1ede496e000e59802fcfad9d9ebc1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Hide floating buttons in standalone mode

## 0.48.2

### Patch Changes

- [`9857116`](https://github.com/openpatch/hyperbook/commit/9857116239e8e0ccef14979605b937f17620cd1b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix wide styling and line-height

## 0.48.1

### Patch Changes

- [`ca5d844`](https://github.com/openpatch/hyperbook/commit/ca5d8441084ed4adf295f19556a5cc5d29a0e07f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix emojis not present. Switch to manual updates.

## 0.48.0

### Minor Changes

- [`a51613f`](https://github.com/openpatch/hyperbook/commit/a51613fe7a8a0ac2b8f521bdae1405e18193f62f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add new `navigation` field for pages and sections, and improve styling coherence.

## 0.47.2

### Patch Changes

- [`7bc2a65`](https://github.com/openpatch/hyperbook/commit/7bc2a655f3dc4c9766fa29bb71cc6349f735f198) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Bump versions

## 0.47.1

### Patch Changes

- [`db806c9`](https://github.com/openpatch/hyperbook/commit/db806c9f23fbac79bb23c14629efce74cfd8f08f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix missing handlebars helpers (like `dateformat`) in pagelist custom snippets. The basic helpers are now properly registered when using custom snippet templates with the pagelist directive.

- [`6fb2e9a`](https://github.com/openpatch/hyperbook/commit/6fb2e9a117ed251aeacbe16ffb3cae3d838bbf27) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix various typos and bugs:
  - Fix "Buildung" typo in build progress messages (should be "Building")
  - Fix "lanuage" typo in error message (should be "language")
  - Fix incorrect MIME type "plain/text" to "text/plain" in dev server
  - Fix "aspectRation" typo to "aspectRatio" in types and VSCode schema
  - Fix CSS property "aspectRatio:" to "aspect-ratio:" in embed directive
  - Fix incorrect repository URL in README (openpath → openpatch)
  - Update minimum Node.js version from 12.22.0 to 18

## 0.47.0

### Minor Changes

- [`04ca48e`](https://github.com/openpatch/hyperbook/commit/04ca48e607d799c770c3b69708549f0206d9c58d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Enhanced pagelist with powerful query language and improved Date handling.

  **New Query Language Features:**

  - Boolean operators: `AND`, `OR`, `NOT` for combining conditions
  - Parentheses for grouping: `(condition1 OR condition2) AND condition3`
  - Custom frontmatter field queries: `difficulty(beginner)`, `tags(tutorial)`
  - Operator precedence: `NOT` > `AND` > `OR`

  **New Parameters:**

  - `limit`: Limit the number of results returned
  - `orderBy`: Sort by any field including custom frontmatter (e.g., `date:desc`, `difficulty:asc`)

  **Date Handling:**

  - YAML date values without quotes (e.g., `date: 2025-01-09`) now work correctly for filtering and sorting

## 0.46.2

### Patch Changes

- [`47310d3`](https://github.com/openpatch/hyperbook/commit/47310d3406aff746924e498d3197db76a73d8826) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix duplicate entries in pagelist

## 0.46.1

### Patch Changes

- [`0cc1647`](https://github.com/openpatch/hyperbook/commit/0cc164760073bc95656e76c647fdeba7a187f3f0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix typst preview styling

## 0.46.0

### Minor Changes

- [#1063](https://github.com/openpatch/hyperbook/pull/1063) [`66a7234`](https://github.com/openpatch/hyperbook/commit/66a72340b367920e12349c988104fda6ebbcf3fc) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add Typst directive with interactive editor and improved error handling. The new Typst directive enables users to write and preview Typst documents directly in Hyperbook with support for multiple files, binary assets, and PDF export. Errors display as dismissible overlays preserving the last successful render, with clean error messages parsed from the Rust SourceDiagnostic format.

## 0.45.0

### Minor Changes

- [`f01224f`](https://github.com/openpatch/hyperbook/commit/f01224f0a16deff51271fec740d0001eef544c39) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Replace JavaScript-dependent UI elements with native HTML for better accessibility and no-JS support

  This major update converts collapsibles, navigation sections, and tabs to use native HTML elements, making core functionality work without JavaScript while maintaining progressive enhancement for state persistence and synchronization.

  **Navigation & Collapsibles:**

  - Navigation sections use native `<details>` and `<summary>` elements
  - Collapsible directive uses native HTML details/summary
  - Empty sections styled with italic text to indicate non-clickable headers
  - JavaScript provides progressive enhancement: state persistence and multi-element sync

  **Tabs Directive:**

  - Converted to CSS-only tabs using hidden radio buttons and labels
  - Works completely without JavaScript using native HTML form controls
  - JavaScript adds state persistence and multi-instance synchronization
  - Active tab indicator using `:has()` CSS selector
  - Supports up to 10 tabs per group
  - Multiple tab groups with same ID sync across the page when JavaScript is enabled

  **Progressive No-JS Support:**

  - Hide JavaScript-dependent UI elements when JS is disabled (search, share, QR, export/import/reset buttons)
  - Add `no-js` class to HTML element, removed immediately when JavaScript loads
  - All core content navigation and interaction works without JavaScript
  - Better SEO as all content is visible to search engines

  **Accessibility Improvements:**

  - Native HTML elements provide better keyboard navigation
  - Screen reader friendly with proper ARIA semantics
  - Browser-native focus management
  - Reduced complexity and improved compatibility

## 0.44.1

### Patch Changes

- [`d2b1c7c`](https://github.com/openpatch/hyperbook/commit/d2b1c7c453c8c81486727aa8b2f07cb0f0d268ef) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Performance and optimization improvements

  - Added `font-display: swap` to all font-face declarations for better page load performance
  - Added `defer` attribute to script tags to improve page load speed
  - Minified dexie-export-import.js bundle to reduce file size
  - Added explicit height attribute to logo image for better CLS scores

## 0.44.0

### Minor Changes

- [`28ec20e`](https://github.com/openpatch/hyperbook/commit/28ec20ee0da8d31ca166023b9fc645c047bb0a1a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add shareable URL builder with sections filter

  - Added share button (🔗 icon) in header that opens a dialog for creating shareable URLs
  - Implemented sections filter query parameter to show only specific content sections
  - Added live URL preview with standalone mode toggle and section selection checkboxes
  - QR code now includes all query parameters in the generated code
  - TOC toggle hides automatically when sections are filtered
  - Floating action buttons (TOC, QR code) now use dynamic flexbox positioning
  - Both share and QR dialogs moved outside content area to remain visible when filtering

### Patch Changes

- [`5c6def7`](https://github.com/openpatch/hyperbook/commit/5c6def7d6a740fac7a0dc75b1172fd71b1de57c9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Hide multieventy element on page load to not reveal the solutions.

## 0.43.5

### Patch Changes

- [`208b695`](https://github.com/openpatch/hyperbook/commit/208b695f7a8eab8def611f7b94ffaf5b9988aded) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update pyodide to version 0.29.0

## 0.43.4

### Patch Changes

- [`ed1497c`](https://github.com/openpatch/hyperbook/commit/ed1497cd7fe00bf542300380a9db62f98bc2a4b9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update learningmap

## 0.43.3

### Patch Changes

- [`cfcd5da`](https://github.com/openpatch/hyperbook/commit/cfcd5da9e82099ea8169ba7ec95099d3eafbc93a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update learningmap

## 0.43.2

### Patch Changes

- [`129dd60`](https://github.com/openpatch/hyperbook/commit/129dd60eb5a871de0d5ed9b4610e9b342c459a98) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update learningmap

## 0.43.1

### Patch Changes

- [`9a36558`](https://github.com/openpatch/hyperbook/commit/9a36558b0f90b05c972071953ce5f36203e93016) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update dependencies

## 0.43.0

### Minor Changes

- [`64f904b`](https://github.com/openpatch/hyperbook/commit/64f904b59afe0cd480887fc88205676fa45bef1d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Prev and next buttons are now visible even in if hide is true. You have to manually disable them with prev: and next: .

## 0.42.3

### Patch Changes

- [`3b9cef9`](https://github.com/openpatch/hyperbook/commit/3b9cef9fb15c3be43fbc967736f9cbfec0e67e25) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix scripts and styles not working in vs code

## 0.42.2

### Patch Changes

- [`8766f62`](https://github.com/openpatch/hyperbook/commit/8766f62c2450b8fc3fa1dae49323ec9cb2ae2a12) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix images have doubled base paths

## 0.42.1

### Patch Changes

- [`601c959`](https://github.com/openpatch/hyperbook/commit/601c959da43b7437378f590e6e92fb8b7a6a3baa) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix learningmap not learning from relative path

## 0.42.0

### Minor Changes

- [`1846430`](https://github.com/openpatch/hyperbook/commit/1846430dc148766c210104ab8ccbc9aca0bc71b8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add complete state persistence to multievent directive with visual feedback restoration

  The multievent directive now saves and restores its complete state, including all visual feedback from evaluations. When users reload the page, they can see whether their task was evaluated as correct or incorrect.

  Features:

  - New `multievent` table in Dexie store with schema `id, state`
  - Automatic state saving on all user interactions (input changes, button clicks, evaluations)
  - Complete restoration of visual feedback including:
    - Green highlighting (#9f0) for correct answers
    - Orange striped backgrounds (#f90) for incorrect answers
    - Error indicators (🔍/🔎) next to items needing attention
    - Evaluation button state with green border when completed
    - Success/failure hint visibility
    - HangMan (word puzzle) progress and error display
    - Word search button states and highlighting
  - State is saved per multievent instance and per page URL
  - Seamless integration with existing export/import functionality

## 0.41.0

### Minor Changes

- [#1035](https://github.com/openpatch/hyperbook/pull/1035) [`c4fddb6`](https://github.com/openpatch/hyperbook/commit/c4fddb66b15ab2808998296a0e7aa51a6e565193) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add custom data table to Dexie store for user-managed state persistence

  This adds a new `custom` table to the Hyperbook Dexie store, enabling users to persist arbitrary JSON data in the browser's IndexedDB.

  Features:

  - New `custom` table with schema `id, payload` for storing user-defined data
  - Comprehensive documentation in the advanced section showing how to use the API
  - Automatic inclusion in existing export/import functionality
  - Full support for storing and retrieving JSON data using `store.custom.put()` and `store.custom.get()`

## 0.40.0

### Minor Changes

- Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add custom data table to Dexie store for user-managed state persistence

  This adds a new `custom` table to the Hyperbook Dexie store, enabling users to persist arbitrary JSON data in the browser's IndexedDB.

  Features:

  - New `custom` table with schema `id, payload` for storing user-defined data
  - Comprehensive documentation in the advanced section showing how to use the API
  - Automatic inclusion in existing export/import functionality
  - Full support for storing and retrieving JSON data using `store.custom.put()` and `store.custom.get()`

## 0.39.0

### Minor Changes

- [`4a94df7`](https://github.com/openpatch/hyperbook/commit/4a94df7c951e8dc0e4bbaf0cbfff03a87decd230) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Open external links in a new tab

## 0.38.0

### Minor Changes

- [#1027](https://github.com/openpatch/hyperbook/pull/1027) [`cf0b13a`](https://github.com/openpatch/hyperbook/commit/cf0b13abb37ead597a3b7b961fd9a347b2e89bd6) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add new textinput directive for persistent text input with Dexie store integration

  This adds a new `::textinput` markdown directive that creates interactive text input areas with automatic persistence to the browser's Dexie database.

  Features:

  - Customizable placeholder and height attributes
  - Automatic save with debouncing for performance
  - Multiple independent inputs via custom IDs
  - Full light and dark mode support
  - Responsive design with error handling

## 0.37.2

### Patch Changes

- [`08b5a56`](https://github.com/openpatch/hyperbook/commit/08b5a56a3a34f55af81b0094070f8760de7fcc88) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix favicon path

- Fix relative path

## 0.37.1

### Patch Changes

- [`4048965`](https://github.com/openpatch/hyperbook/commit/4048965a0071ccf874c31c99375ec549a7170a3f) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Fix sqlide custom db not using the correct url

## 0.37.0

### Minor Changes

- [`5373ec3`](https://github.com/openpatch/hyperbook/commit/5373ec312c2ede462422003300e325d3d8439dad) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Use learningmap web component for the real project

## 0.36.2

### Patch Changes

- [`18ef87a`](https://github.com/openpatch/hyperbook/commit/18ef87abfa7e98ed93e6c174040b4954add08cfc) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Change last fix to keep backward-compatability

## 0.36.1

### Patch Changes

- [`0bfb0bd`](https://github.com/openpatch/hyperbook/commit/0bfb0bdfc3a2f4b8d5645765953784373de55ebf) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix GeoGebra not loading the correct file

## 0.36.0

### Minor Changes

- [#1017](https://github.com/openpatch/hyperbook/pull/1017) [`ae25b60`](https://github.com/openpatch/hyperbook/commit/ae25b605ab2b4945c62d4d9e83955af57fa50b00) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add page layout options with automatic iframe detection

  - Added three layout options: default, wide, and standalone
  - Wide layout provides full-width content with drawer-only navigation, ideal for tables, galleries, and code examples
  - Standalone layout displays content only (no header, sidebar, footer) for clean iframe embedding
  - Standalone mode can be activated via frontmatter (`layout: standalone`), URL parameter (`?standalone=true`), or automatic iframe detection
  - Automatically hides TOC toggle and QR code buttons when in standalone mode
  - Zero-configuration embedding: pages automatically switch to standalone mode when embedded in iframes
  - Added comprehensive documentation in Advanced Features section with usage examples and demos
  - All changes are backward compatible with existing pages

## 0.35.1

### Patch Changes

- [#1013](https://github.com/openpatch/hyperbook/pull/1013) [`9c96045`](https://github.com/openpatch/hyperbook/commit/9c96045020c45dc06cc2da8e86de2fa6c2ba2a32) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add automatic favicon and PWA icon generation from logo

  When building a Hyperbook project, if no favicon.ico exists and a logo is defined in hyperbook.json, a complete set of favicons and PWA assets are automatically generated:

  - Generates 60+ files including favicon.ico, Android icons, Apple touch icons, and Apple startup images
  - Creates web manifest with full PWA metadata (theme color, scope, language, developer info)
  - Smart logo path resolution: checks root folder, book folder, and public folder
  - Adds favicon, Apple touch icon, and manifest links to all HTML pages
  - Uses hyperbook.json metadata: name, description, colors.brand, basePath, language, author
  - Backward compatible: copies favicon.ico to root for browsers expecting it there

## 0.35.0

### Minor Changes

- [#1011](https://github.com/openpatch/hyperbook/pull/1011) [`f6f1b25`](https://github.com/openpatch/hyperbook/commit/f6f1b25f7a07e2cfcd8c2cfeb1807788aaa6c307) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Vastly improved learningmap element

## 0.34.1

### Patch Changes

- [`44f6627`](https://github.com/openpatch/hyperbook/commit/44f6627748f55bc49d10a59455a500c006334c93) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix url not prefixed correctly in learningmaps

## 0.34.0

### Minor Changes

- [`25a216f`](https://github.com/openpatch/hyperbook/commit/25a216f4f3d4b63f2c1db89880e7e0ee29d84da8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add learningmap element

## 0.33.3

### Patch Changes

- [`5c65176`](https://github.com/openpatch/hyperbook/commit/5c65176472e27865696574ec398d5480899b96df) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix all IDEs not showing the correct code

## 0.33.2

### Patch Changes

- [`6f41f96`](https://github.com/openpatch/hyperbook/commit/6f41f963ad592c2aa45e122a7c4fd89c3f596a75) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix alert not working correctly in other container elements

## 0.33.1

### Patch Changes

- [`b585d55`](https://github.com/openpatch/hyperbook/commit/b585d55638e4efb97ef71def8619dd8fd979845d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix alignment when using a block element after an image.

## 0.33.0

### Minor Changes

- [`287dd41`](https://github.com/openpatch/hyperbook/commit/287dd41e1bece7b5ba1295c4f9db19934c34b611) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Autoload math display libraries in all h5p elements.

## 0.32.0

### Minor Changes

- [`f9e5bb7`](https://github.com/openpatch/hyperbook/commit/f9e5bb7be1970a6e1fb9fa444f4b6063dfa5fbd6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Use alert color for headings, links and bold text

## 0.31.0

### Minor Changes

- [`e6dabb8`](https://github.com/openpatch/hyperbook/commit/e6dabb8e4a47930c21ae479cabc25c6727215206) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add custom alerts

## 0.30.0

### Minor Changes

- [`3f6ac8c`](https://github.com/openpatch/hyperbook/commit/3f6ac8cc3009d5eb7a1085119d046a5602b277b9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add image positioning and styling options

## 0.29.5

### Patch Changes

- [`e3d104d`](https://github.com/openpatch/hyperbook/commit/e3d104d8d6154ef35474a919e7d995bdc579ad67) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Use js extension instead of mjs to improve compatability with common servers.

- [`bfd5fd0`](https://github.com/openpatch/hyperbook/commit/bfd5fd0a58f7a19a4a3b22e82fc0e2b16c43fe73) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix sub and superscript interfering with links.

## 0.29.4

### Patch Changes

- [`cc0aad9`](https://github.com/openpatch/hyperbook/commit/cc0aad93558dfce8072c31549bd7c8d9e5a927b6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix toc configuration one more time

## 0.29.3

### Patch Changes

- [`29a1464`](https://github.com/openpatch/hyperbook/commit/29a146441bf28fe85c2e755c7119da1a7d39340e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix toc and qrcode configurations not working correct.

## 0.29.2

### Patch Changes

- [#992](https://github.com/openpatch/hyperbook/pull/992) [`a30a565`](https://github.com/openpatch/hyperbook/commit/a30a565778ae53b377d7da5c85f2d22f949d4a92) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update emoji shortcodes.

## 0.29.1

### Patch Changes

- [`c18ba75`](https://github.com/openpatch/hyperbook/commit/c18ba75d415e3d23eb1fafb7ebe69eac082457e0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix colons in headings not working. Fix spaces in filenames causing trouble. Add option to disable code highlighting and copy button for inline code blocks.

## 0.29.0

### Minor Changes

- [`b914f85`](https://github.com/openpatch/hyperbook/commit/b914f8580aaae9969cb2be97b5ab6f1e7ce8564f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - You can now collocate images, videos, and other additional files directly within your book directory. This means you can reference media using relative paths, making it much easier to:

  - Organize your content intuitively
  - Collaborate with others
  - Share or version-control your Hyperbook with media included

  Example usage:

  ```md
  ![Image in the same directory as this markdown file](./image.png)
  ![Image one directory up relative to this markdown file](../image.png)
  ```

  This improvement enables a more seamless and portable authoring experience—no more managing separate static folders or absolute paths.

## 0.28.5

### Patch Changes

- [`829d71d`](https://github.com/openpatch/hyperbook/commit/829d71dc228d2fd4ba1d75d0c58095326afcfaa6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Do not parse e.g. :1 as a element. Only parse the documented elements.

## 0.28.4

### Patch Changes

- [`d2a02f5`](https://github.com/openpatch/hyperbook/commit/d2a02f502f69f1f216750ffd33ef84bcbab72d94) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix qr codes not showing correctly

## 0.28.3

### Patch Changes

- [`5544ee7`](https://github.com/openpatch/hyperbook/commit/5544ee723a8b3b201509480718aa55c4868c9cf3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Default to youtube-nocookie

## 0.28.2

### Patch Changes

- [`7910a8e`](https://github.com/openpatch/hyperbook/commit/7910a8ee4a002c54dafc1d5d29d0e5f0b49b04e8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve table responsive design.

## 0.28.1

### Patch Changes

- [`b4b9593`](https://github.com/openpatch/hyperbook/commit/b4b9593aa46c33b47aa311e6aa7c8d0117bd753b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

## 0.28.0

### Minor Changes

- [`9938ddd`](https://github.com/openpatch/hyperbook/commit/9938ddd3fe0876f7e69507593349d8f6d090934e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add multievent element

## 0.27.0

### Minor Changes

- [`8545973`](https://github.com/openpatch/hyperbook/commit/8545973ded8a8da94bda1485f5560a5f62c64153) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Styling Improvements:
  - Increased the width of the navigation to utilize more horizontal space.
  - Reduced base font size to 14px for improved readability and a more compact layout.
  - Decreased header height to 60px to maximize vertical content space.

## 0.26.0

### Minor Changes

- [`ff50422`](https://github.com/openpatch/hyperbook/commit/ff504220e5c57607d51f858e5c9a46dde252f8fc) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add jsxgraph element

## 0.25.4

### Patch Changes

- [`660d949`](https://github.com/openpatch/hyperbook/commit/660d9491198ffaeeda9141f4d634bfda202a8963) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The reset button for GeoGebra did not rerun the initial commands.

## 0.25.3

### Patch Changes

- [`86714e6`](https://github.com/openpatch/hyperbook/commit/86714e6838547ccb1e779fb9ba765168c93bd37f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fire resize event after the collapsible is expanded.

## 0.25.2

### Patch Changes

- [`8712ab5`](https://github.com/openpatch/hyperbook/commit/8712ab5557f00ef85a782f9219829e1f1eba5973) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fire resize event when a collapsible is opened. This is need for GeoGebra to resize the applet.

## 0.25.1

### Patch Changes

- [`549b9d8`](https://github.com/openpatch/hyperbook/commit/549b9d8947a5c860bf8029a6c20a1ab86d2549df) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix geogebra styling

- [`ba25548`](https://github.com/openpatch/hyperbook/commit/ba255486bb005b5c1836354e8ca9292b4f3a859d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve responsive scaling of the geogebra element and save/load its current state.

## 0.25.0

### Minor Changes

- [#964](https://github.com/openpatch/hyperbook/pull/964) [`6557bb3`](https://github.com/openpatch/hyperbook/commit/6557bb3116aff3c2091922998c34d7559fa3c863) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add h5p element

## 0.24.13

### Patch Changes

- [`e1720b5`](https://github.com/openpatch/hyperbook/commit/e1720b5eec08da070bd76881e47c23b6850bb880) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update dependencies

## 0.24.12

### Patch Changes

- [`2641bc4`](https://github.com/openpatch/hyperbook/commit/2641bc4a15b3b93d33ded59f3983847943bd1b81) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix missing right border

## 0.24.11

### Patch Changes

- [`08bde20`](https://github.com/openpatch/hyperbook/commit/08bde20e5a832f6777963fc478a8987b86ee2921) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add footnote translation for german

## 0.24.10

### Patch Changes

- [`e2e97e7`](https://github.com/openpatch/hyperbook/commit/e2e97e7cc602da2fd8bb3bfba22c0ec7a1dd4cc9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix collapsibles not having an id

## 0.24.9

### Patch Changes

- [`9139c65`](https://github.com/openpatch/hyperbook/commit/9139c6543491ee3295981985e523bf6757b7bf76) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix p5 not accepting editor=false

## 0.24.8

### Patch Changes

- [`b28e9d5`](https://github.com/openpatch/hyperbook/commit/b28e9d5359b22bae30df0fb0665a03da3f889653) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix styling and collapsibles for the main navigation

## 0.24.7

### Patch Changes

- [`de22a0c`](https://github.com/openpatch/hyperbook/commit/de22a0cad0cad1b8ae9ff216b1c710a03f4a3b5b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Remove p5.sound. The library caused the p5-element to not load on Safari.

## 0.24.6

### Patch Changes

- [`8adce9d`](https://github.com/openpatch/hyperbook/commit/8adce9d3dc345886f0b3e7a2fd3e4d848b00e183) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix link to section not including the basePath

## 0.24.5

### Patch Changes

- [`dcda048`](https://github.com/openpatch/hyperbook/commit/dcda048737044f38ec7a6c5a64e122acd0932a28) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix heading in collapsible breaking the build

## 0.24.4

### Patch Changes

- [`f36eb85`](https://github.com/openpatch/hyperbook/commit/f36eb85b025b654dd2e217f40b7d598ae2b9c2d3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - remove unwanted console.log

## 0.24.3

### Patch Changes

- [`327a4e9`](https://github.com/openpatch/hyperbook/commit/327a4e98cc52c0ac073a3a0b0c13ce5d4cecc6c8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - - fix section not expanded after reload
  - fix styling of sections

## 0.24.2

### Patch Changes

- [`049053a`](https://github.com/openpatch/hyperbook/commit/049053ab19afac0d6379b33e49a7290a2e5132a2) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - wrong query

- [`e9ffcd2`](https://github.com/openpatch/hyperbook/commit/e9ffcd2b190fce63a9db7d15519201cd8cb8ef55) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix search not working.

## 0.24.1

### Patch Changes

- [`c0f47d9`](https://github.com/openpatch/hyperbook/commit/c0f47d9a55c696740bb10c2e99270369d6feabe5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix collapsible button selector not bleeding into other buttons

## 0.24.0

### Minor Changes

- [`79ea7bb`](https://github.com/openpatch/hyperbook/commit/79ea7bb3c8a80776aa7a9aef1698d87145d8cc09) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add webide element

## 0.23.2

### Patch Changes

- [`8019a88`](https://github.com/openpatch/hyperbook/commit/8019a88ce03f80a8e8a8bbce6671f6589da38442) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix tabs and collapsibles not rendering hyperbook elements

## 0.23.1

### Patch Changes

- [`e46f8ae`](https://github.com/openpatch/hyperbook/commit/e46f8ae9fce8915a08de3f3c5a880dbe1bfa1150) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix reload listener not being remove in pyide

## 0.23.0

### Minor Changes

- [`b5a41e0`](https://github.com/openpatch/hyperbook/commit/b5a41e00a014a77dd13a5e8d13009c5c2462cb15) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - - Save every state of the hyperbook and make it available for download. To enable this feature, set `importExport` to `true` in the configuration file. The buttons for importing and exporting will be at the bottom of the page. The state of the hyperbook will be saved as a JSON file. The file can be imported again to restore the state of the hyperbook.
  - The code of the editor for the elements P5, Pyide, ABC-Music can now be copied, download or resetted.

### Patch Changes

- [`b5a41e0`](https://github.com/openpatch/hyperbook/commit/b5a41e00a014a77dd13a5e8d13009c5c2462cb15) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug when protecting an interactive element. Now the elements are initialized after being reveled.
  Fix that collapsibles with the same id were not synced.

## 0.22.1

### Patch Changes

- [`2ed165e`](https://github.com/openpatch/hyperbook/commit/2ed165ef62341d7dd4fa073a4f913dd352da809e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug when protecting an interactive element. Now the elements are initialized after being reveled.
  Fix that collapsibles with the same id were not synced.

## 0.22.0

### Minor Changes

- [#925](https://github.com/openpatch/hyperbook/pull/925) [`b0a1d3e`](https://github.com/openpatch/hyperbook/commit/b0a1d3e08118a3c3ba6406ec8bf9aec0683a3df5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add pyide

- [#925](https://github.com/openpatch/hyperbook/pull/925) [`b0a1d3e`](https://github.com/openpatch/hyperbook/commit/b0a1d3e08118a3c3ba6406ec8bf9aec0683a3df5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add input and tests to pyide

## 0.21.0

### Minor Changes

- [#923](https://github.com/openpatch/hyperbook/pull/923) [`3da49ba`](https://github.com/openpatch/hyperbook/commit/3da49baf31f414d8c1de7e4c4fcdac6b8556674f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add pyide

## 0.20.0

### Minor Changes

- [#897](https://github.com/openpatch/hyperbook/pull/897) [`33724b8`](https://github.com/openpatch/hyperbook/commit/33724b8c46c588d30bce661c32244fc34896209f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add p5 element

## 0.19.0

### Minor Changes

- [`8d23c1a`](https://github.com/openpatch/hyperbook/commit/8d23c1a80c1f344a7c5bf2a43d7ebaf90d816d0c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add abc music element. For displaying and creating music with notes.

## 0.18.0

### Minor Changes

- [`7af5dd0`](https://github.com/openpatch/hyperbook/commit/7af5dd0c41bf47f0bbd2ff4f4d16a5411e7ccccb) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Allow emojis in tabs

## 0.17.1

### Patch Changes

- [`124f573`](https://github.com/openpatch/hyperbook/commit/124f573acddab763617f6bdfd261d64aca516f26) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix ios white box issue

## 0.17.0

### Minor Changes

- [`05b262a`](https://github.com/openpatch/hyperbook/commit/05b262af61d920ed4b0dc4d3b3e88c85424e74cf) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add dark mode toggle

### Patch Changes

- [`7126cb7`](https://github.com/openpatch/hyperbook/commit/7126cb7349b3ad54d1593bce72dc364b14a27e68) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - improve css

- [`769228e`](https://github.com/openpatch/hyperbook/commit/769228eea963ba58147747362aa50ffc4c8fba3c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix search results not visually pleasing in light mode

## 0.16.0

### Minor Changes

- [`28d5912`](https://github.com/openpatch/hyperbook/commit/28d5912d977c6eb4eb57d5f222a96d3fc5387282) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Remove menu animation for better experience

## 0.15.3

### Patch Changes

- [`d4876f7`](https://github.com/openpatch/hyperbook/commit/d4876f7db102a98da1d37f10a3e15633f396ce1f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix virtual section not rendering

## 0.15.2

### Patch Changes

- [`a63ee6b`](https://github.com/openpatch/hyperbook/commit/a63ee6b3cefac39f90ba6f368886a7ed73d9f40c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix virtual section is visible

## 0.15.1

### Patch Changes

- [`3cdf623`](https://github.com/openpatch/hyperbook/commit/3cdf6235fc52061977e856f5df99df1f68a25742) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix searchEl not found

## 0.15.0

### Minor Changes

- [#909](https://github.com/openpatch/hyperbook/pull/909) [`88071bd`](https://github.com/openpatch/hyperbook/commit/88071bd13ca297a32f110e322e7142e7b0406736) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add GeoGebra element.

## 0.14.0

### Minor Changes

- [#907](https://github.com/openpatch/hyperbook/pull/907) [`eaeaf29`](https://github.com/openpatch/hyperbook/commit/eaeaf293532494607385f4e8d927ffb3716dcc6f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add option to enable search. Just set the search key to true in your hyperbook config and a search icon will be visible in the top right hand corner.

## 0.13.2

### Patch Changes

- [`2ab94ae`](https://github.com/openpatch/hyperbook/commit/2ab94aea525c2b67c156313f13d9662efad5d8a6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix pagelist snippets not parsed correctly

## 0.13.1

### Patch Changes

- [`300e589`](https://github.com/openpatch/hyperbook/commit/300e589f9de4fa6dc5ed76e4649240c93a8eae6c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix online ide has wrong file names when using showLineNumbers in hyperbook config.

## 0.13.0

### Minor Changes

- [`d9f0b71`](https://github.com/openpatch/hyperbook/commit/d9f0b711775195fc56d9706dc196edf577591b2e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Allow permaids to be set in the frontmatter of a page. The permaids can be use in links and in the frontmatter for next and prev. See the page configuration documentation for details. All pages with permaids are available at /@/[permaid].

## 0.12.2

### Patch Changes

- [`d5bcb38`](https://github.com/openpatch/hyperbook/commit/d5bcb38e2b641a292bae161ee3b1893d80b14360) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix position of copy button in code blocks

## 0.12.1

### Patch Changes

- [`eb6c5a3`](https://github.com/openpatch/hyperbook/commit/eb6c5a3ae05721fee0a657ccb63124d6e1194d22) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - move qr code generation to the client

## 0.12.0

### Minor Changes

- [#894](https://github.com/openpatch/hyperbook/pull/894) [`8536870`](https://github.com/openpatch/hyperbook/commit/8536870623eb21bfaeffc0c65022584c26ea75c9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - add option to show a qr code to the current page

## 0.11.2

### Patch Changes

- [`6347d43`](https://github.com/openpatch/hyperbook/commit/6347d4392318e6bc8f52c4543fc65da7317f7d13) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix title showing undefined if page has no name

## 0.11.1

### Patch Changes

- [`440abf8`](https://github.com/openpatch/hyperbook/commit/440abf80ffcbcf70a0aed053ce58e0a36034eec1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix mermaid not rendering when using angled brackets

## 0.11.0

### Minor Changes

- [`cfb27a1`](https://github.com/openpatch/hyperbook/commit/cfb27a112ede0ac7850bddd10474d23485f9f052) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve ouput for CI environments and make failure message clearer.

### Patch Changes

- [`4fe7d11`](https://github.com/openpatch/hyperbook/commit/4fe7d1127f79936a9479877d264f4988073f8859) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix sections not expanded on reload

- [`e73a321`](https://github.com/openpatch/hyperbook/commit/e73a321f46eb8de4002361e259de8080266f35c1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix license not rendering as a link

## 0.10.1

### Patch Changes

- [`5588011`](https://github.com/openpatch/hyperbook/commit/5588011c3819816de125a3bea3513f8539f650f8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix submenu not staying open on page reload

## 0.10.0

### Minor Changes

- [#882](https://github.com/openpatch/hyperbook/pull/882) [`26ae87e`](https://github.com/openpatch/hyperbook/commit/26ae87e19b01b6c2f45590ade4d681c5a27c932a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The release is a complete rewrite of the underlying process to generate the
  HTML files. React was removed from the project and replaced with remark
  plugins. This improves build times and give us more control over the whole
  process. For example there is no need anymore for running `npx hyperbook
setup`.

  I also added a new pagelist directive, which can be used to list pages based
  on user-defined criteria. This directive also replaces the included glossary
  page. Therefore, you need to create on yourself. This can be easily done by
  creating a page `glossary.md` with the following content:

  ```md
  ---
  name: Glossary
  ---

  ::pagelist{format="glossary" source="href(/glossary/)"}
  ```

  Additionally, I added the ability to use custom JavaScript and CSS-files - see
  the documentation under Advanced Features - in addition to using HTML in your
  hyperbook, when the `allowDangerousHtml` option is enabled in your config.

  I also improved the appearance of custom links, by moving them to the
  footer on mobile devices.

## 0.9.7

### Patch Changes

- [`2bfe682`](https://github.com/openpatch/hyperbook/commit/2bfe6828e578399c405bf4fc52fb1845efe2fb6a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update packages

## 0.9.6

### Patch Changes

- Fix wbr visible on page

## 0.9.5

### Patch Changes

- [`4a3a21f`](https://github.com/openpatch/hyperbook/commit/4a3a21f40c0355c308e8dcb723234c0434aced23) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

- Updated dependencies [[`4a3a21f`](https://github.com/openpatch/hyperbook/commit/4a3a21f40c0355c308e8dcb723234c0434aced23)]:
  - @hyperbook/drawer@0.1.2
  - @hyperbook/provider@0.4.2

## 0.9.4

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.4.1

## 0.9.3

### Patch Changes

- [`d723aaf`](https://github.com/openpatch/hyperbook/commit/d723aafed2eab1ebef7eda5055ba59f2d4e16a9b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix fs module for windows. This should also fix the vscode extension on windows.

## 0.9.2

### Patch Changes

- [`bfa3016`](https://github.com/openpatch/hyperbook/commit/bfa30169bf2e6377385c6a1adb5aa625db7d1b68) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug with remark

- [`e84275a`](https://github.com/openpatch/hyperbook/commit/e84275a11949e455be4a00742528541b969d52f1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

- [`42ab56f`](https://github.com/openpatch/hyperbook/commit/42ab56f0e07a5adca5e7485a61d21d59d41ad100) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix missing package

## 0.9.1

### Patch Changes

- Updated dependencies [[`75a3227`](https://github.com/openpatch/hyperbook/commit/75a322721e2e0af3c248ab12fb72cca357d6f4d8)]:
  - @hyperbook/drawer@0.1.1

## 0.9.0

### Minor Changes

- [`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Move to pure ESM packages

### Patch Changes

- Updated dependencies [[`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de)]:
  - @hyperbook/provider@0.4.0
  - @hyperbook/drawer@0.1.0

## 0.8.1

### Patch Changes

- [`c6c7d1f`](https://github.com/openpatch/hyperbook/commit/c6c7d1f3dda16879166398916792025545e344ea) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix unified package wrong export error

- [`9851b21`](https://github.com/openpatch/hyperbook/commit/9851b21db8d19c849110eca623bfc450c76e06b9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - bundle unified to handle wrong import

## 0.8.0

### Minor Changes

- [`ff0e867`](https://github.com/openpatch/hyperbook/commit/ff0e86788d967194d442026b49d23082960c66da) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve the build of hyperbooks and the generation of the toc.

## 0.7.0

### Minor Changes

- [`4e264d1`](https://github.com/openpatch/hyperbook/commit/4e264d166684ba476460fd48fedfae2f7e2a3195) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - open external links in a new window or tab

- [`902c0b3`](https://github.com/openpatch/hyperbook/commit/902c0b30a0aa97984350cfd58ad88d38ef7b4cd6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve static site generation

### Patch Changes

- Updated dependencies [[`902c0b3`](https://github.com/openpatch/hyperbook/commit/902c0b30a0aa97984350cfd58ad88d38ef7b4cd6)]:
  - @hyperbook/provider@0.3.0

## 0.6.4

### Patch Changes

- [`edf8e94`](https://github.com/openpatch/hyperbook/commit/edf8e943e9b9c393121cfc1d859dc91e44af30c1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix data not defined

- Updated dependencies [[`edf8e94`](https://github.com/openpatch/hyperbook/commit/edf8e943e9b9c393121cfc1d859dc91e44af30c1)]:
  - @hyperbook/provider@0.2.5

## 0.6.3

### Patch Changes

- [`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update packages

- Updated dependencies [[`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e)]:
  - @hyperbook/provider@0.2.4

## 0.6.2

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.2.3

## 0.6.1

### Patch Changes

- [`cf58c13`](https://github.com/openpatch/hyperbook/commit/cf58c13ca19aaba8e20e6e1cb27ab3ebbfb74d37) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

- Updated dependencies [[`cf58c13`](https://github.com/openpatch/hyperbook/commit/cf58c13ca19aaba8e20e6e1cb27ab3ebbfb74d37)]:
  - @hyperbook/provider@0.2.2

## 0.6.0

### Minor Changes

- [`764a681`](https://github.com/openpatch/hyperbook/commit/764a681e4a8b0135ffa83f0a30c4cda23b79babd) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - You can now add customs ids to headings. This allow for stable links even if the content of the heading changes.

### Patch Changes

- [`fa2719e`](https://github.com/openpatch/hyperbook/commit/fa2719ebb2bd535aa09a9358ebb53c5c277ad630) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix use custom id in heading component.

## 0.5.3

### Patch Changes

- [`0c58ad8`](https://github.com/openpatch/hyperbook/commit/0c58ad80c3c8b145868d2c0303d42478ec0a9978) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix type error in the remove comments plugin for rehype.

## 0.5.2

### Patch Changes

- [`ac262ca`](https://github.com/openpatch/hyperbook/commit/ac262ca4a60b313dafbce33e5c0d753fd504f012) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve the css for image lightboxes. The cursor now only changes when hovering the image and not the left and right border.

## 0.5.1

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.2.1

## 0.5.0

### Minor Changes

- [`60e8fb1`](https://github.com/openpatch/hyperbook/commit/60e8fb1a3a95d7797234a0ba4f64adba65b74792) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve code copying behaviour on iOS and improve styling for inline code snippets on every platform.

## 0.4.3

### Patch Changes

- [`5758cf0`](https://github.com/openpatch/hyperbook/commit/5758cf025f81b3ec6e5c33d6309ca47166e6db3a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix: Move optional break to text instead of title

## 0.4.2

### Patch Changes

- [`23413c7`](https://github.com/openpatch/hyperbook/commit/23413c74ae0338c063d13f98a78b08ffb8d7f065) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix format title not url of a link.

## 0.4.1

### Patch Changes

- [#458](https://github.com/openpatch/hyperbook/pull/458) [`27032d1`](https://github.com/openpatch/hyperbook/commit/27032d1d76a07b590c18094139ba4a4bf74780c3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Optimize line breaks. We now insert an optional word break point into links. So the browser knows when to break it. For this we follow this guide: https://css-tricks.com/better-line-breaks-for-long-urls/. This does also fix issue #451

## 0.4.0

### Minor Changes

- [`c526071`](https://github.com/openpatch/hyperbook/commit/c526071d11e9c248c933bade1ac1298a0fcbeefb) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add lightbox for images. You can now click on an image to display a larger preview.

### Patch Changes

- [`28b803e`](https://github.com/openpatch/hyperbook/commit/28b803efbeac6835afc0040b7f1fb03c210cc72d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix toc toggle misaligned bars on iPad

- [`42cf26c`](https://github.com/openpatch/hyperbook/commit/42cf26cacd32026fa95ab850c4d5e8f2b96b9c37) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix height on iOS

## 0.3.4

### Patch Changes

- Updated dependencies [[`8d53899`](https://github.com/openpatch/hyperbook/commit/8d538999fc924f7b3e3115416cba4978c9589b68)]:
  - @hyperbook/provider@0.2.0

## 0.3.3

### Patch Changes

- [`e526943`](https://github.com/openpatch/hyperbook/commit/e526943fec3ef91cfce853af6a0c5cdaf3f22eef) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Column headers of tables now have a margin in mobile view.

## 0.3.2

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.1.7

## 0.3.1

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.1.6

## 0.3.0

### Minor Changes

- [#338](https://github.com/openpatch/hyperbook/pull/338) [`774405b`](https://github.com/openpatch/hyperbook/commit/774405b936b10bf90e884ec7201cb38c734db8c3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - We now remove HTML comments from your Markdown files. The comments will be
  completely removed from the HTML output. So you can use these for adding hints
  for your co-authors, or removing a section of your book from the output, but
  not from the source code.

  HTML comments also work across multiple lines. Here you can see an example:

  ```md
  <!-- This is a HTML comment -->

  <!--
    It
    also
    works
    across
    multiple
    lines
  -->
  ```

## 0.2.0

### Minor Changes

- [#326](https://github.com/openpatch/hyperbook/pull/326) [`9472583`](https://github.com/openpatch/hyperbook/commit/947258359e33a39362c070f6c7128f214a79c4c5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add configuration options to the hyperbook.json for the element bookmarks and excalidraw.

### Patch Changes

- Updated dependencies []:
  - @hyperbook/provider@0.1.5

## 0.1.6

### Patch Changes

- Fix error when heading is empty. For example when writing a heading in our VS Code extension.

## 0.1.5

### Patch Changes

- Updated dependencies [[`cedb551`](https://github.com/openpatch/hyperbook/commit/cedb55191fd025b5a214df406a53cbab5d1b1bc1)]:
  - @hyperbook/provider@0.1.4

## 0.1.4

### Patch Changes

- Updated dependencies [[`c3e747a`](https://github.com/openpatch/hyperbook/commit/c3e747ab7b95c3e526b3800b169aa8f505f9b9a2)]:
  - @hyperbook/provider@0.1.3

## 0.1.3

### Patch Changes

- [`a7be20c`](https://github.com/openpatch/hyperbook/commit/a7be20c426ee96cefdc198e843b30eda32e96c75) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - remove react-icons

## 0.1.2

### Patch Changes

- Updated dependencies [[`2c34554`](https://github.com/openpatch/hyperbook/commit/2c34554f64359fb995190b1465daddfa3e0101c0)]:
  - @hyperbook/provider@0.1.2

## 0.1.1

### Patch Changes

- [`9ea5483`](https://github.com/openpatch/hyperbook/commit/9ea5483512fd5134f6823104a68fecea2c50cb00) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Force package update due to failed pipeline

- Updated dependencies [[`9ea5483`](https://github.com/openpatch/hyperbook/commit/9ea5483512fd5134f6823104a68fecea2c50cb00)]:
  - @hyperbook/provider@0.1.1

## 0.1.0

### Minor Changes

- [`6c1bd51`](https://github.com/openpatch/hyperbook/commit/6c1bd51e7ded1b2094ba590e5d8ddc5c0f6254b8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Extract feature in separate packages. This allows for easier development of new templates and allows enables to make changes more transparent.

### Patch Changes

- Updated dependencies [[`6c1bd51`](https://github.com/openpatch/hyperbook/commit/6c1bd51e7ded1b2094ba590e5d8ddc5c0f6254b8)]:
  - @hyperbook/provider@0.1.0
