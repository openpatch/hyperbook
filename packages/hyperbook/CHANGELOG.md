# hyperbook

## 0.75.0

### Minor Changes

- [`285212a`](https://github.com/openpatch/hyperbook/commit/285212a9ebc8aca431881d74e76528bdf4f2dc75) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add new Handlebars helpers for snippets and templates.

  **New Helpers:**

  - `dateformat`: Format dates with customizable patterns (YYYY-MM-DD, DD.MM.YYYY HH:mm:ss, etc.)
  - `truncate`: Truncate strings by character limit with configurable suffix
  - `truncateWords`: Truncate strings by word count with configurable suffix

## 0.74.0

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

## 0.73.5

### Patch Changes

- [`b7cc012`](https://github.com/openpatch/hyperbook/commit/b7cc0127cce919291fa2984f3dd76a8d220b0ab8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add emoji example to tiles documentation

## 0.73.4

### Patch Changes

- [`47310d3`](https://github.com/openpatch/hyperbook/commit/47310d3406aff746924e498d3197db76a73d8826) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix duplicate entries in pagelist

## 0.73.3

### Patch Changes

- [`b0ebc52`](https://github.com/openpatch/hyperbook/commit/b0ebc52bccd63ced735757709013ed6c37adca0a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Another fix for the index.md in directory problem

## 0.73.2

### Patch Changes

- [`c5ae1cc`](https://github.com/openpatch/hyperbook/commit/c5ae1cc46e8b552e8c85725f94f197999da4fe5f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix path resolving when having an index.md in a directory.

## 0.73.1

### Patch Changes

- [`0cc1647`](https://github.com/openpatch/hyperbook/commit/0cc164760073bc95656e76c647fdeba7a187f3f0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix typst preview styling

## 0.73.0

### Minor Changes

- [`c0a5249`](https://github.com/openpatch/hyperbook/commit/c0a5249eb7598418e57866c941fee9b8323f56b8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - add typst

## 0.72.2

### Patch Changes

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

## 0.72.1

### Patch Changes

- [`d2b1c7c`](https://github.com/openpatch/hyperbook/commit/d2b1c7c453c8c81486727aa8b2f07cb0f0d268ef) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Performance and optimization improvements

  - Added `font-display: swap` to all font-face declarations for better page load performance
  - Added `defer` attribute to script tags to improve page load speed
  - Minified dexie-export-import.js bundle to reduce file size
  - Added explicit height attribute to logo image for better CLS scores

## 0.72.0

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

## 0.71.5

### Patch Changes

- [`208b695`](https://github.com/openpatch/hyperbook/commit/208b695f7a8eab8def611f7b94ffaf5b9988aded) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update pyodide to version 0.29.0

## 0.71.4

### Patch Changes

- [`ed1497c`](https://github.com/openpatch/hyperbook/commit/ed1497cd7fe00bf542300380a9db62f98bc2a4b9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update learningmap

## 0.71.3

### Patch Changes

- [`cfcd5da`](https://github.com/openpatch/hyperbook/commit/cfcd5da9e82099ea8169ba7ec95099d3eafbc93a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update learningmap

## 0.71.2

### Patch Changes

- [`098aab3`](https://github.com/openpatch/hyperbook/commit/098aab3c1ec1520a07e255bddaec433bc6798323) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix lunr path

## 0.71.1

### Patch Changes

- [`e4ad15c`](https://github.com/openpatch/hyperbook/commit/e4ad15caffd749df450201bc664b34a18081c8a2) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add lunr languages to dist

## 0.71.0

### Minor Changes

- [`c6fcba4`](https://github.com/openpatch/hyperbook/commit/c6fcba4e8e87e12dbaaaf4d83a322d6fe0541462) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add create-hyperbook package for using `npx create hyperbook`

- [`9f93524`](https://github.com/openpatch/hyperbook/commit/9f935246904d22b73393fe9d7b2f4aae49011e78) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve the new command and make it accessible in the vs code extension.

## 0.70.2

### Patch Changes

- [`129dd60`](https://github.com/openpatch/hyperbook/commit/129dd60eb5a871de0d5ed9b4610e9b342c459a98) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update learningmap

## 0.70.1

### Patch Changes

- [`9a36558`](https://github.com/openpatch/hyperbook/commit/9a36558b0f90b05c972071953ce5f36203e93016) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update dependencies

## 0.70.0

### Minor Changes

- [`159473a`](https://github.com/openpatch/hyperbook/commit/159473aa378de2596eb0f0d493a3a6a48dc007f1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Support relative links in next and prev of the frontmatter

## 0.69.0

### Minor Changes

- [`64f904b`](https://github.com/openpatch/hyperbook/commit/64f904b59afe0cd480887fc88205676fa45bef1d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Prev and next buttons are now visible even in if hide is true. You have to manually disable them with prev: and next: .

## 0.68.4

### Patch Changes

- [`3b9cef9`](https://github.com/openpatch/hyperbook/commit/3b9cef9fb15c3be43fbc967736f9cbfec0e67e25) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix scripts and styles not working in vs code

## 0.68.3

### Patch Changes

- [`93f4966`](https://github.com/openpatch/hyperbook/commit/93f496654b2730d955ce2ddb766dfd98fefd9c68) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix glossary pages not using custom scripts and styles

## 0.68.2

### Patch Changes

- [`8766f62`](https://github.com/openpatch/hyperbook/commit/8766f62c2450b8fc3fa1dae49323ec9cb2ae2a12) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix images have doubled base paths

## 0.68.1

### Patch Changes

- [`601c959`](https://github.com/openpatch/hyperbook/commit/601c959da43b7437378f590e6e92fb8b7a6a3baa) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix learningmap not learning from relative path

## 0.68.0

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

## 0.67.0

### Minor Changes

- [#1035](https://github.com/openpatch/hyperbook/pull/1035) [`c4fddb6`](https://github.com/openpatch/hyperbook/commit/c4fddb66b15ab2808998296a0e7aa51a6e565193) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add custom data table to Dexie store for user-managed state persistence

  This adds a new `custom` table to the Hyperbook Dexie store, enabling users to persist arbitrary JSON data in the browser's IndexedDB.

  Features:

  - New `custom` table with schema `id, payload` for storing user-defined data
  - Comprehensive documentation in the advanced section showing how to use the API
  - Automatic inclusion in existing export/import functionality
  - Full support for storing and retrieving JSON data using `store.custom.put()` and `store.custom.get()`

## 0.66.0

### Minor Changes

- Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add custom data table to Dexie store for user-managed state persistence

  This adds a new `custom` table to the Hyperbook Dexie store, enabling users to persist arbitrary JSON data in the browser's IndexedDB.

  Features:

  - New `custom` table with schema `id, payload` for storing user-defined data
  - Comprehensive documentation in the advanced section showing how to use the API
  - Automatic inclusion in existing export/import functionality
  - Full support for storing and retrieving JSON data using `store.custom.put()` and `store.custom.get()`

### Patch Changes

- Updated dependencies:
  - @hyperbook/markdown@0.40.0

## 0.65.0

### Minor Changes

- [`4a94df7`](https://github.com/openpatch/hyperbook/commit/4a94df7c951e8dc0e4bbaf0cbfff03a87decd230) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Open external links in a new tab

## 0.64.0

### Minor Changes

- [#1027](https://github.com/openpatch/hyperbook/pull/1027) [`cf0b13a`](https://github.com/openpatch/hyperbook/commit/cf0b13abb37ead597a3b7b961fd9a347b2e89bd6) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add new textinput directive for persistent text input with Dexie store integration

  This adds a new `::textinput` markdown directive that creates interactive text input areas with automatic persistence to the browser's Dexie database.

  Features:

  - Customizable placeholder and height attributes
  - Automatic save with debouncing for performance
  - Multiple independent inputs via custom IDs
  - Full light and dark mode support
  - Responsive design with error handling

## 0.63.2

### Patch Changes

- [`08b5a56`](https://github.com/openpatch/hyperbook/commit/08b5a56a3a34f55af81b0094070f8760de7fcc88) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix favicon path

- Fix relative path

## 0.63.1

### Patch Changes

- [`4048965`](https://github.com/openpatch/hyperbook/commit/4048965a0071ccf874c31c99375ec549a7170a3f) Thanks [@github-actions[bot]](https://github.com/github-actions%5Bbot%5D)! - Fix sqlide custom db not using the correct url

## 0.63.0

### Minor Changes

- [#1023](https://github.com/openpatch/hyperbook/pull/1023) [`ffe7e4b`](https://github.com/openpatch/hyperbook/commit/ffe7e4b037b6d50e13e52d555e81a599e0ab3bb7) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add llms.txt file generation feature. When the `llms` property is set to `true` in hyperbook.json, a `llms.txt` file will be generated during build that combines all markdown files in order. The file includes the book name and version in the header. Pages and sections with `hide: true` are automatically excluded from the generated file.

## 0.62.0

### Minor Changes

- [`5373ec3`](https://github.com/openpatch/hyperbook/commit/5373ec312c2ede462422003300e325d3d8439dad) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Use learningmap web component for the real project

## 0.61.3

### Patch Changes

- [`18ef87a`](https://github.com/openpatch/hyperbook/commit/18ef87abfa7e98ed93e6c174040b4954add08cfc) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Change last fix to keep backward-compatability

## 0.61.2

### Patch Changes

- [`0bfb0bd`](https://github.com/openpatch/hyperbook/commit/0bfb0bdfc3a2f4b8d5645765953784373de55ebf) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix GeoGebra not loading the correct file

## 0.61.1

### Patch Changes

- [`e7fa21c`](https://github.com/openpatch/hyperbook/commit/e7fa21c76bc94b80542141daae2e0b83ce1074c4) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix saving width and height in learningmaps

## 0.61.0

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

## 0.60.0

### Minor Changes

- [#1013](https://github.com/openpatch/hyperbook/pull/1013) [`9c96045`](https://github.com/openpatch/hyperbook/commit/9c96045020c45dc06cc2da8e86de2fa6c2ba2a32) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Add automatic favicon and PWA icon generation from logo

  When building a Hyperbook project, if no favicon.ico exists and a logo is defined in hyperbook.json, a complete set of favicons and PWA assets are automatically generated:

  - Generates 60+ files including favicon.ico, Android icons, Apple touch icons, and Apple startup images
  - Creates web manifest with full PWA metadata (theme color, scope, language, developer info)
  - Smart logo path resolution: checks root folder, book folder, and public folder
  - Adds favicon, Apple touch icon, and manifest links to all HTML pages
  - Uses hyperbook.json metadata: name, description, colors.brand, basePath, language, author
  - Backward compatible: copies favicon.ico to root for browsers expecting it there

## 0.59.0

### Minor Changes

- [#1011](https://github.com/openpatch/hyperbook/pull/1011) [`f6f1b25`](https://github.com/openpatch/hyperbook/commit/f6f1b25f7a07e2cfcd8c2cfeb1807788aaa6c307) Thanks [@copilot-swe-agent](https://github.com/apps/copilot-swe-agent)! - Vastly improved learningmap element

## 0.58.2

### Patch Changes

- [`fa3ecfa`](https://github.com/openpatch/hyperbook/commit/fa3ecfa082f6f13c292f504d4260910a0425c3bb) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Retain scroll position in dev-mode when the page reloads.

## 0.58.1

### Patch Changes

- [`44f6627`](https://github.com/openpatch/hyperbook/commit/44f6627748f55bc49d10a59455a500c006334c93) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix url not prefixed correctly in learningmaps

## 0.58.0

### Minor Changes

- [`25a216f`](https://github.com/openpatch/hyperbook/commit/25a216f4f3d4b63f2c1db89880e7e0ee29d84da8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add learningmap element

## 0.57.3

### Patch Changes

- [`5c65176`](https://github.com/openpatch/hyperbook/commit/5c65176472e27865696574ec398d5480899b96df) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix all IDEs not showing the correct code

## 0.57.2

### Patch Changes

- [`6f41f96`](https://github.com/openpatch/hyperbook/commit/6f41f963ad592c2aa45e122a7c4fd89c3f596a75) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix alert not working correctly in other container elements

## 0.57.1

### Patch Changes

- [`b585d55`](https://github.com/openpatch/hyperbook/commit/b585d55638e4efb97ef71def8619dd8fd979845d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix alignment when using a block element after an image.

## 0.57.0

### Minor Changes

- [`287dd41`](https://github.com/openpatch/hyperbook/commit/287dd41e1bece7b5ba1295c4f9db19934c34b611) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Autoload math display libraries in all h5p elements.

- [`7ef905d`](https://github.com/openpatch/hyperbook/commit/7ef905d4f19828034d57af230a0ab2335689d9a3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add c and l variables to snippets to allow for dynamic amount of colons.

## 0.56.0

### Minor Changes

- [`f9e5bb7`](https://github.com/openpatch/hyperbook/commit/f9e5bb7be1970a6e1fb9fa444f4b6063dfa5fbd6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Use alert color for headings, links and bold text

## 0.55.0

### Minor Changes

- [`e6dabb8`](https://github.com/openpatch/hyperbook/commit/e6dabb8e4a47930c21ae479cabc25c6727215206) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add custom alerts

## 0.54.0

### Minor Changes

- [`3f6ac8c`](https://github.com/openpatch/hyperbook/commit/3f6ac8cc3009d5eb7a1085119d046a5602b277b9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add image positioning and styling options

## 0.53.7

### Patch Changes

- [`e3d104d`](https://github.com/openpatch/hyperbook/commit/e3d104d8d6154ef35474a919e7d995bdc579ad67) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Use js extension instead of mjs to improve compatability with common servers.

- [`bfd5fd0`](https://github.com/openpatch/hyperbook/commit/bfd5fd0a58f7a19a4a3b22e82fc0e2b16c43fe73) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix sub and superscript interfering with links.

## 0.53.6

### Patch Changes

- [`cc0aad9`](https://github.com/openpatch/hyperbook/commit/cc0aad93558dfce8072c31549bd7c8d9e5a927b6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix toc configuration one more time

## 0.53.5

### Patch Changes

- [`29a1464`](https://github.com/openpatch/hyperbook/commit/29a146441bf28fe85c2e755c7119da1a7d39340e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix toc and qrcode configurations not working correct.

## 0.53.4

### Patch Changes

- [#992](https://github.com/openpatch/hyperbook/pull/992) [`a30a565`](https://github.com/openpatch/hyperbook/commit/a30a565778ae53b377d7da5c85f2d22f949d4a92) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update emoji shortcodes.

## 0.53.3

### Patch Changes

- [`c18ba75`](https://github.com/openpatch/hyperbook/commit/c18ba75d415e3d23eb1fafb7ebe69eac082457e0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix colons in headings not working. Fix spaces in filenames causing trouble. Add option to disable code highlighting and copy button for inline code blocks.

## 0.53.2

### Patch Changes

- [`91587c4`](https://github.com/openpatch/hyperbook/commit/91587c465412956142c0798a65258ebbfb8986bf) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix build crashes if index.md is empty

## 0.53.1

### Patch Changes

- [`e93c807`](https://github.com/openpatch/hyperbook/commit/e93c807db31d22bdc1b30d88bece90f1f7360912) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix sections need a index.md

## 0.53.0

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

## 0.52.7

### Patch Changes

- [`829d71d`](https://github.com/openpatch/hyperbook/commit/829d71dc228d2fd4ba1d75d0c58095326afcfaa6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Do not parse e.g. :1 as a element. Only parse the documented elements.

## 0.52.6

### Patch Changes

- [`d2a02f5`](https://github.com/openpatch/hyperbook/commit/d2a02f502f69f1f216750ffd33ef84bcbab72d94) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix qr codes not showing correctly

## 0.52.5

### Patch Changes

- [`0c0d297`](https://github.com/openpatch/hyperbook/commit/0c0d29753efb2aec37c819ba12091c393cb2b17e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix cli argument port not used

## 0.52.4

### Patch Changes

- [`b1fa62c`](https://github.com/openpatch/hyperbook/commit/b1fa62c447ef079c395ed09d25d87da0ea20ddfc) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix dev server not respecting basePath

## 0.52.3

### Patch Changes

- [`5544ee7`](https://github.com/openpatch/hyperbook/commit/5544ee723a8b3b201509480718aa55c4868c9cf3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Default to youtube-nocookie

## 0.52.2

### Patch Changes

- [`7910a8e`](https://github.com/openpatch/hyperbook/commit/7910a8ee4a002c54dafc1d5d29d0e5f0b49b04e8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve table responsive design.

## 0.52.1

### Patch Changes

- [`b4b9593`](https://github.com/openpatch/hyperbook/commit/b4b9593aa46c33b47aa311e6aa7c8d0117bd753b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

## 0.52.0

### Minor Changes

- [`9938ddd`](https://github.com/openpatch/hyperbook/commit/9938ddd3fe0876f7e69507593349d8f6d090934e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add multievent element

## 0.51.1

### Patch Changes

- [`8545973`](https://github.com/openpatch/hyperbook/commit/8545973ded8a8da94bda1485f5560a5f62c64153) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Styling Improvements:
  - Increased the width of the navigation to utilize more horizontal space.
  - Reduced base font size to 14px for improved readability and a more compact layout.
  - Decreased header height to 60px to maximize vertical content space.

## 0.51.0

### Minor Changes

- [`ff50422`](https://github.com/openpatch/hyperbook/commit/ff504220e5c57607d51f858e5c9a46dde252f8fc) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add jsxgraph element

## 0.50.5

### Patch Changes

- [`9671fff`](https://github.com/openpatch/hyperbook/commit/9671fffd2f52d272e346a70f2727ed7ad9c894f7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The development server does not crash anymore, when an error occurs.

## 0.50.4

### Patch Changes

- [`660d949`](https://github.com/openpatch/hyperbook/commit/660d9491198ffaeeda9141f4d634bfda202a8963) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The reset button for GeoGebra did not rerun the initial commands.

## 0.50.3

### Patch Changes

- [`86714e6`](https://github.com/openpatch/hyperbook/commit/86714e6838547ccb1e779fb9ba765168c93bd37f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fire resize event after the collapsible is expanded.

## 0.50.2

### Patch Changes

- [`8712ab5`](https://github.com/openpatch/hyperbook/commit/8712ab5557f00ef85a782f9219829e1f1eba5973) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fire resize event when a collapsible is opened. This is need for GeoGebra to resize the applet.

## 0.50.1

### Patch Changes

- [`ba25548`](https://github.com/openpatch/hyperbook/commit/ba255486bb005b5c1836354e8ca9292b4f3a859d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve responsive scaling of the geogebra element and save/load its current state.

## 0.50.0

### Minor Changes

- [#964](https://github.com/openpatch/hyperbook/pull/964) [`6557bb3`](https://github.com/openpatch/hyperbook/commit/6557bb3116aff3c2091922998c34d7559fa3c863) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add h5p element

## 0.49.4

### Patch Changes

- [`e1720b5`](https://github.com/openpatch/hyperbook/commit/e1720b5eec08da070bd76881e47c23b6850bb880) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update dependencies

## 0.49.3

### Patch Changes

- [`2641bc4`](https://github.com/openpatch/hyperbook/commit/2641bc4a15b3b93d33ded59f3983847943bd1b81) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix missing right border

## 0.49.2

### Patch Changes

- [`08bde20`](https://github.com/openpatch/hyperbook/commit/08bde20e5a832f6777963fc478a8987b86ee2921) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add footnote translation for german

## 0.49.1

### Patch Changes

- [`e2e97e7`](https://github.com/openpatch/hyperbook/commit/e2e97e7cc602da2fd8bb3bfba22c0ec7a1dd4cc9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix collapsibles not having an id

## 0.49.0

### Minor Changes

- [`847e151`](https://github.com/openpatch/hyperbook/commit/847e1516ef0b0c3f4ca4f06fac1ea5e16cbbe175) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Make hyperbook config accessible in snippets

## 0.48.8

### Patch Changes

- Updated dependencies [[`69328bb`](https://github.com/openpatch/hyperbook/commit/69328bb8b52cb683246a0d553941e249d89a7bf6)]:
  - @hyperbook/fs@0.17.0

## 0.48.7

### Patch Changes

- [`b28e9d5`](https://github.com/openpatch/hyperbook/commit/b28e9d5359b22bae30df0fb0665a03da3f889653) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix styling and collapsibles for the main navigation

## 0.48.6

### Patch Changes

- [`e9bfec9`](https://github.com/openpatch/hyperbook/commit/e9bfec9f06eccabb119f8800274c69d14b2c0211) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix parsing of snippets parameters.

- Updated dependencies [[`e9bfec9`](https://github.com/openpatch/hyperbook/commit/e9bfec9f06eccabb119f8800274c69d14b2c0211)]:
  - @hyperbook/fs@0.16.1

## 0.48.5

### Patch Changes

- [`8adce9d`](https://github.com/openpatch/hyperbook/commit/8adce9d3dc345886f0b3e7a2fd3e4d848b00e183) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix link to section not including the basePath

## 0.48.4

### Patch Changes

- [`dcda048`](https://github.com/openpatch/hyperbook/commit/dcda048737044f38ec7a6c5a64e122acd0932a28) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix heading in collapsible breaking the build

## 0.48.3

### Patch Changes

- [`f36eb85`](https://github.com/openpatch/hyperbook/commit/f36eb85b025b654dd2e217f40b7d598ae2b9c2d3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - remove unwanted console.log

## 0.48.2

### Patch Changes

- [`e9ffcd2`](https://github.com/openpatch/hyperbook/commit/e9ffcd2b190fce63a9db7d15519201cd8cb8ef55) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix search not working.

## 0.48.1

### Patch Changes

- [`c0f47d9`](https://github.com/openpatch/hyperbook/commit/c0f47d9a55c696740bb10c2e99270369d6feabe5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix collapsible button selector not bleeding into other buttons

## 0.48.0

### Minor Changes

- [`79ea7bb`](https://github.com/openpatch/hyperbook/commit/79ea7bb3c8a80776aa7a9aef1698d87145d8cc09) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add webide element

## 0.47.2

### Patch Changes

- [`8019a88`](https://github.com/openpatch/hyperbook/commit/8019a88ce03f80a8e8a8bbce6671f6589da38442) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix tabs and collapsibles not rendering hyperbook elements

## 0.47.1

### Patch Changes

- [`78ccf8c`](https://github.com/openpatch/hyperbook/commit/78ccf8cde8f49804673183eb65df771616ac4a84) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix devserver injecting reload script at the wrong place.

## 0.47.0

### Minor Changes

- [`b5a41e0`](https://github.com/openpatch/hyperbook/commit/b5a41e00a014a77dd13a5e8d13009c5c2462cb15) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - - Save every state of the hyperbook and make it available for download. To enable this feature, set `importExport` to `true` in the configuration file. The buttons for importing and exporting will be at the bottom of the page. The state of the hyperbook will be saved as a JSON file. The file can be imported again to restore the state of the hyperbook.
  - The code of the editor for the elements P5, Pyide, ABC-Music can now be copied, download or resetted.

### Patch Changes

- [`b5a41e0`](https://github.com/openpatch/hyperbook/commit/b5a41e00a014a77dd13a5e8d13009c5c2462cb15) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug when protecting an interactive element. Now the elements are initialized after being reveled.
  Fix that collapsibles with the same id were not synced.
- Updated dependencies [[`b5a41e0`](https://github.com/openpatch/hyperbook/commit/b5a41e00a014a77dd13a5e8d13009c5c2462cb15)]:
  - @hyperbook/types@0.14.0
  - @hyperbook/fs@0.16.0

## 0.46.1

### Patch Changes

- [`2ed165e`](https://github.com/openpatch/hyperbook/commit/2ed165ef62341d7dd4fa073a4f913dd352da809e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug when protecting an interactive element. Now the elements are initialized after being reveled.
  Fix that collapsibles with the same id were not synced.

## 0.46.0

### Minor Changes

- [`cd6535e`](https://github.com/openpatch/hyperbook/commit/cd6535e236f8ae64b28003dd196f37413a50e5a3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add trailingSlash back

### Patch Changes

- Updated dependencies [[`cd6535e`](https://github.com/openpatch/hyperbook/commit/cd6535e236f8ae64b28003dd196f37413a50e5a3)]:
  - @hyperbook/types@0.13.0
  - @hyperbook/fs@0.16.0

## 0.45.0

### Minor Changes

- [#925](https://github.com/openpatch/hyperbook/pull/925) [`b0a1d3e`](https://github.com/openpatch/hyperbook/commit/b0a1d3e08118a3c3ba6406ec8bf9aec0683a3df5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add pyide

- [#925](https://github.com/openpatch/hyperbook/pull/925) [`b0a1d3e`](https://github.com/openpatch/hyperbook/commit/b0a1d3e08118a3c3ba6406ec8bf9aec0683a3df5) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add input and tests to pyide

## 0.44.0

### Minor Changes

- [#923](https://github.com/openpatch/hyperbook/pull/923) [`3da49ba`](https://github.com/openpatch/hyperbook/commit/3da49baf31f414d8c1de7e4c4fcdac6b8556674f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add pyide

## 0.43.0

### Minor Changes

- [#897](https://github.com/openpatch/hyperbook/pull/897) [`33724b8`](https://github.com/openpatch/hyperbook/commit/33724b8c46c588d30bce661c32244fc34896209f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add p5 element

## 0.42.0

### Minor Changes

- [`8d23c1a`](https://github.com/openpatch/hyperbook/commit/8d23c1a80c1f344a7c5bf2a43d7ebaf90d816d0c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add abc music element. For displaying and creating music with notes.

## 0.41.0

### Minor Changes

- [`7af5dd0`](https://github.com/openpatch/hyperbook/commit/7af5dd0c41bf47f0bbd2ff4f4d16a5411e7ccccb) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Allow emojis in tabs

## 0.40.1

### Patch Changes

- [`124f573`](https://github.com/openpatch/hyperbook/commit/124f573acddab763617f6bdfd261d64aca516f26) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix ios white box issue

## 0.40.0

### Minor Changes

- [`05b262a`](https://github.com/openpatch/hyperbook/commit/05b262af61d920ed4b0dc4d3b3e88c85424e74cf) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add dark mode toggle

### Patch Changes

- [`7126cb7`](https://github.com/openpatch/hyperbook/commit/7126cb7349b3ad54d1593bce72dc364b14a27e68) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - improve css

## 0.39.1

### Patch Changes

- [`698acbb`](https://github.com/openpatch/hyperbook/commit/698acbb5189453e25c295acaba59be87202e7d09) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix hyperbook double rebuilding in dev mode

- Updated dependencies [[`27d2f47`](https://github.com/openpatch/hyperbook/commit/27d2f47e0e669b3738f62206bed767d29abce18a)]:
  - @hyperbook/fs@0.16.0

## 0.39.0

### Minor Changes

- [`05b75d7`](https://github.com/openpatch/hyperbook/commit/05b75d7f59c8492fdbf4c422b35e85b740429e90) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add ?version= at the end of an asset url to refresh the cache if a new hyperbook version is released.

- [`28d5912`](https://github.com/openpatch/hyperbook/commit/28d5912d977c6eb4eb57d5f222a96d3fc5387282) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Remove menu animation for better experience

## 0.38.4

### Patch Changes

- [`d4876f7`](https://github.com/openpatch/hyperbook/commit/d4876f7db102a98da1d37f10a3e15633f396ce1f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix virtual section not rendering

## 0.38.3

### Patch Changes

- [`a63ee6b`](https://github.com/openpatch/hyperbook/commit/a63ee6b3cefac39f90ba6f368886a7ed73d9f40c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix virtual section is visible

## 0.38.2

### Patch Changes

- [`3cdf623`](https://github.com/openpatch/hyperbook/commit/3cdf6235fc52061977e856f5df99df1f68a25742) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix searchEl not found

## 0.38.1

### Patch Changes

- [`d1e977c`](https://github.com/openpatch/hyperbook/commit/d1e977c1e1414cb49c1b88623948a73e5c51995d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add html extensions to permaid files

## 0.38.0

### Minor Changes

- [#909](https://github.com/openpatch/hyperbook/pull/909) [`88071bd`](https://github.com/openpatch/hyperbook/commit/88071bd13ca297a32f110e322e7142e7b0406736) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add GeoGebra element.

## 0.37.0

### Minor Changes

- [#907](https://github.com/openpatch/hyperbook/pull/907) [`eaeaf29`](https://github.com/openpatch/hyperbook/commit/eaeaf293532494607385f4e8d927ffb3716dcc6f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add option to enable search. Just set the search key to true in your hyperbook config and a search icon will be visible in the top right hand corner.

### Patch Changes

- Updated dependencies [[`eaeaf29`](https://github.com/openpatch/hyperbook/commit/eaeaf293532494607385f4e8d927ffb3716dcc6f)]:
  - @hyperbook/types@0.12.0
  - @hyperbook/fs@0.15.0

## 0.36.2

### Patch Changes

- [`2ab94ae`](https://github.com/openpatch/hyperbook/commit/2ab94aea525c2b67c156313f13d9662efad5d8a6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix pagelist snippets not parsed correctly

## 0.36.1

### Patch Changes

- [`331d74f`](https://github.com/openpatch/hyperbook/commit/331d74fd4000b11fbf5f63a98382f2c0ab547a46) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - bump version

## 0.36.0

### Minor Changes

- [`d9f0b71`](https://github.com/openpatch/hyperbook/commit/d9f0b711775195fc56d9706dc196edf577591b2e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Allow permaids to be set in the frontmatter of a page. The permaids can be use in links and in the frontmatter for next and prev. See the page configuration documentation for details. All pages with permaids are available at /@/[permaid].

### Patch Changes

- Updated dependencies [[`d9f0b71`](https://github.com/openpatch/hyperbook/commit/d9f0b711775195fc56d9706dc196edf577591b2e)]:
  - @hyperbook/types@0.11.0
  - @hyperbook/fs@0.15.0

## 0.35.3

### Patch Changes

- Updated dependencies [[`8536870`](https://github.com/openpatch/hyperbook/commit/8536870623eb21bfaeffc0c65022584c26ea75c9)]:
  - @hyperbook/types@0.10.0
  - @hyperbook/fs@0.14.1

## 0.35.2

### Patch Changes

- Updated dependencies [[`2074212`](https://github.com/openpatch/hyperbook/commit/20742126a69229186a01ed7384b7c9ff5af483bd)]:
  - @hyperbook/fs@0.14.1

## 0.35.1

### Patch Changes

- [`f584ddb`](https://github.com/openpatch/hyperbook/commit/f584ddba3d152c8aabb444bfc5a5552fcf9504e4) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix dev server not finding files when using a basePath

## 0.35.0

### Minor Changes

- [`cfb27a1`](https://github.com/openpatch/hyperbook/commit/cfb27a112ede0ac7850bddd10474d23485f9f052) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve ouput for CI environments and make failure message clearer.

## 0.34.3

### Patch Changes

- [`c95321a`](https://github.com/openpatch/hyperbook/commit/c95321aaf18462f1b2bd2363f386c6fc54dcd83b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - readd setup command and print a deprecated message.

## 0.34.2

### Patch Changes

- [`0fde9fb`](https://github.com/openpatch/hyperbook/commit/0fde9fb26c7a9794dc8bdd9d431d96ce761926d7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix md files in root directory getting ignored

## 0.34.1

### Patch Changes

- [`368e461`](https://github.com/openpatch/hyperbook/commit/368e461eb1ea009eb4eac3463c74d82bbbe590c6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix out folder not correct

## 0.34.0

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

### Patch Changes

- Updated dependencies [[`26ae87e`](https://github.com/openpatch/hyperbook/commit/26ae87e19b01b6c2f45590ade4d681c5a27c932a)]:
  - @hyperbook/types@0.9.0
  - @hyperbook/fs@0.14.0

## 0.33.3

### Patch Changes

- Updated dependencies [[`2bfe682`](https://github.com/openpatch/hyperbook/commit/2bfe6828e578399c405bf4fc52fb1845efe2fb6a)]:
  - @hyperbook/fs@0.13.1

## 0.33.2

### Patch Changes

- [`617d70a`](https://github.com/openpatch/hyperbook/commit/617d70ab41503f4f225eecdb537e41999435ea76) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix hyperbook.json already present, which leads to build errors in docker container.

## 0.33.1

### Patch Changes

- [`983144f`](https://github.com/openpatch/hyperbook/commit/983144f1dc28db06146264b1e5c7a7a0ec5dd95c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - add path to log

## 0.33.0

### Minor Changes

- [`556d732`](https://github.com/openpatch/hyperbook/commit/556d7329ad3ca575cca21ac0b497d78e7c6dceac) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add more status messages when building

## 0.32.0

### Minor Changes

- [`59a484c`](https://github.com/openpatch/hyperbook/commit/59a484c6dc2d566dac0a4fa3384a593a137cef1f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Report errors when failing a command

## 0.31.3

## 0.31.2

### Patch Changes

- [`cc2fb44`](https://github.com/openpatch/hyperbook/commit/cc2fb449b4c7894bf78bafcec27dbe37a8f6b697) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - remove unnecessary export

## 0.31.1

### Patch Changes

- Updated dependencies [[`c500196`](https://github.com/openpatch/hyperbook/commit/c500196fe68bd9af55086fd16f74b202f53b23ec)]:
  - @hyperbook/fs@0.13.0

## 0.31.0

### Patch Changes

- [`88d13ce`](https://github.com/openpatch/hyperbook/commit/88d13ceaf38a293739ad98e1384c91cf6e2bb5c4) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix error when running setup and build

- [`4a3a21f`](https://github.com/openpatch/hyperbook/commit/4a3a21f40c0355c308e8dcb723234c0434aced23) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

- Updated dependencies [[`4a3a21f`](https://github.com/openpatch/hyperbook/commit/4a3a21f40c0355c308e8dcb723234c0434aced23)]:
  - @hyperbook/fs@0.12.1
  - @hyperbook/types@0.8.1

## 0.30.1

### Patch Changes

- Updated dependencies [[`90c99bd`](https://github.com/openpatch/hyperbook/commit/90c99bd0edc9ea8da5e1c6376e09d1977f881870)]:
  - @hyperbook/types@0.8.0
  - @hyperbook/fs@0.12.0

## 0.30.0

## 0.29.4

### Patch Changes

- Updated dependencies [[`d723aaf`](https://github.com/openpatch/hyperbook/commit/d723aafed2eab1ebef7eda5055ba59f2d4e16a9b)]:
  - @hyperbook/fs@0.11.3

## 0.29.3

## 0.29.2

## 0.29.1

## 0.29.0

## 0.28.3

### Patch Changes

- Updated dependencies [[`5792288`](https://github.com/openpatch/hyperbook/commit/57922883e159929aba257f8411fd122f0e804daf)]:
  - @hyperbook/fs@0.11.2

## 0.28.2

### Patch Changes

- Updated dependencies [[`cfdb112`](https://github.com/openpatch/hyperbook/commit/cfdb112f3c845db5607f681e4bb2ac521523d292)]:
  - @hyperbook/fs@0.11.1

## 0.28.1

## 0.28.0

### Minor Changes

- [#847](https://github.com/openpatch/hyperbook/pull/847) [`0b893a3`](https://github.com/openpatch/hyperbook/commit/0b893a39ba9f5e3fffa40fc3ce115bd379f43313) Thanks [@elielmartinsbr](https://github.com/elielmartinsbr)! - add video element

## 0.27.1

### Patch Changes

- [`add7313`](https://github.com/openpatch/hyperbook/commit/add7313099754952f27a5de4534607b55043f898) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - use type module for tiles package

## 0.27.0

### Minor Changes

- [`1e92522`](https://github.com/openpatch/hyperbook/commit/1e925225fb8329ddc7b26317ec7779ee008da6a2) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - add tiles

## 0.26.6

### Patch Changes

- [`4042bc1`](https://github.com/openpatch/hyperbook/commit/4042bc1d1e54f6c81d76243b96e8a933d40fea7d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix mermaid bug, which lead to showing an error banner.

## 0.26.5

## 0.26.4

### Patch Changes

- [`183bb32`](https://github.com/openpatch/hyperbook/commit/183bb3253256342882a167332a1ac7209740ab43) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix zoom on iPads

## 0.26.3

### Patch Changes

- [`a4e4f61`](https://github.com/openpatch/hyperbook/commit/a4e4f61e44d2b9acd7b7a465b793baf3546e3fb3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix dev server for windows

## 0.26.2

### Patch Changes

- [`fd877cf`](https://github.com/openpatch/hyperbook/commit/fd877cfce2f3052e129ca27e7bb85e2209b40111) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug in dev mode

## 0.26.1

### Patch Changes

- [`f5ddc0c`](https://github.com/openpatch/hyperbook/commit/f5ddc0c53564ea426d31aff69695e8fc91dfa0e9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix auto zoom for excalidraw elements.

## 0.26.0

### Minor Changes

- [`2e67754`](https://github.com/openpatch/hyperbook/commit/2e67754670a45ce19d4974c80294bff18713f433) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Disable caching, which caused problems. Enable the dev server to serve libraries aswell as individual book.

### Patch Changes

- Updated dependencies [[`2e67754`](https://github.com/openpatch/hyperbook/commit/2e67754670a45ce19d4974c80294bff18713f433)]:
  - @hyperbook/fs@0.11.0

## 0.25.0

### Minor Changes

- [`9cf8f9c`](https://github.com/openpatch/hyperbook/commit/9cf8f9c028c315b63770495b97d0567da0f69c1b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add fullscreen button to the Online IDE and SQL IDE elements.

## 0.24.0

### Minor Changes

- [`81c6d9e`](https://github.com/openpatch/hyperbook/commit/81c6d9e7b5df239db6fc240b7d75221f88587f31) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update base urls for the online ide

## 0.23.2

### Patch Changes

- [`d5dfc57`](https://github.com/openpatch/hyperbook/commit/d5dfc57ba96d9de2cbb7c61be20910b33844731c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Do not minify

- [`bfa3016`](https://github.com/openpatch/hyperbook/commit/bfa30169bf2e6377385c6a1adb5aa625db7d1b68) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug with remark

- [`e84275a`](https://github.com/openpatch/hyperbook/commit/e84275a11949e455be4a00742528541b969d52f1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update dependencies

- [`cd72873`](https://github.com/openpatch/hyperbook/commit/cd72873f64b99da4f07a19d0516faeb5b41107d8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Explicit import React

- [`42ab56f`](https://github.com/openpatch/hyperbook/commit/42ab56f0e07a5adca5e7485a61d21d59d41ad100) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix missing package

## 0.23.1

### Patch Changes

- [`75a3227`](https://github.com/openpatch/hyperbook/commit/75a322721e2e0af3c248ab12fb72cca357d6f4d8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - add missing type

## 0.23.0

### Minor Changes

- [`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Move to pure ESM packages

### Patch Changes

- Updated dependencies [[`9bb80bb`](https://github.com/openpatch/hyperbook/commit/9bb80bbd711a2ec11d84f2263c581d42e92fd7de)]:
  - @hyperbook/types@0.7.0
  - @hyperbook/fs@0.10.0

## 0.22.3

### Patch Changes

- [`c6c7d1f`](https://github.com/openpatch/hyperbook/commit/c6c7d1f3dda16879166398916792025545e344ea) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix unified package wrong export error

- [`9851b21`](https://github.com/openpatch/hyperbook/commit/9851b21db8d19c849110eca623bfc450c76e06b9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - bundle unified to handle wrong import

## 0.22.2

### Patch Changes

- [`19af1f3`](https://github.com/openpatch/hyperbook/commit/19af1f3baae82508091b2f49541449464d88bb28) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix qr package causing an error when building

## 0.22.1

### Patch Changes

- [`2dcc07c`](https://github.com/openpatch/hyperbook/commit/2dcc07ce540e5c3a08a394b739450d7524b2a40c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Use real names instead of file names for the glossary.

## 0.22.0

### Minor Changes

- [`ff0e867`](https://github.com/openpatch/hyperbook/commit/ff0e86788d967194d442026b49d23082960c66da) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve the build of hyperbooks and the generation of the toc.

### Patch Changes

- Updated dependencies [[`ff0e867`](https://github.com/openpatch/hyperbook/commit/ff0e86788d967194d442026b49d23082960c66da)]:
  - @hyperbook/fs@0.9.0

## 0.21.0

### Minor Changes

- [`77c5ef4`](https://github.com/openpatch/hyperbook/commit/77c5ef42ecdb693c27b3eeeca098c712e0bf05b6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve generating the table of content for a page. Headings in code block will now be ignored.

## 0.20.0

### Minor Changes

- [`902c0b3`](https://github.com/openpatch/hyperbook/commit/902c0b30a0aa97984350cfd58ad88d38ef7b4cd6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Improve static site generation

## 0.19.1

## 0.19.0

## 0.18.0

## 0.17.3

## 0.17.2

## 0.17.1

## 0.17.0

### Minor Changes

- [`f98c89e`](https://github.com/openpatch/hyperbook/commit/f98c89ed582a155d5b005ec72a04ae2619c35c47) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add element embed. This elements allow embedding content like GeoGebra Applets, LearningApps etc.

### Patch Changes

- [`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - update packages

- Updated dependencies [[`832678b`](https://github.com/openpatch/hyperbook/commit/832678b39f6a1a6e5cdd361c9c384d341762c09e)]:
  - @hyperbook/fs@0.8.1
  - @hyperbook/types@0.6.1

## 0.16.0

### Minor Changes

- [`511f497`](https://github.com/openpatch/hyperbook/commit/511f497e3e19c4294ddacb4e2b98cb47f35901d9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add single use templates. Every page can now be a template, where you can use all the helper functions defined in the snippets documentation (https://hyperbook.openpatch.org/elements/snippets#helpers). You only have to use the file extension `.md.hbs`.

### Patch Changes

- Updated dependencies [[`13bfad5`](https://github.com/openpatch/hyperbook/commit/13bfad58f5a16d2d54b4043ce855cf6c3bc397a0), [`511f497`](https://github.com/openpatch/hyperbook/commit/511f497e3e19c4294ddacb4e2b98cb47f35901d9)]:
  - @hyperbook/fs@0.8.0

## 0.15.1

### Patch Changes

- Updated dependencies [[`4221fe1`](https://github.com/openpatch/hyperbook/commit/4221fe145a6dfffd9f97459fa2d2694da4b5d78e)]:
  - @hyperbook/types@0.6.0
  - @hyperbook/fs@0.7.5

## 0.15.0

### Minor Changes

- [`cb65222`](https://github.com/openpatch/hyperbook/commit/cb652224860a718149be4c34234eeb8dcdfbfc91) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - add element sql ide

### Patch Changes

- [`5385f57`](https://github.com/openpatch/hyperbook/commit/5385f57a0bac3242eb0166d522c031495d4e79be) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - fix missing import

## 0.14.1

## 0.14.0

### Minor Changes

- [`086019c`](https://github.com/openpatch/hyperbook/commit/086019c276dc42d1262dc104c894065b89203b24) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add element online ide for java

### Patch Changes

- Updated dependencies [[`cf58c13`](https://github.com/openpatch/hyperbook/commit/cf58c13ca19aaba8e20e6e1cb27ab3ebbfb74d37)]:
  - @hyperbook/fs@0.7.5

## 0.13.14

## 0.13.13

## 0.13.12

### Patch Changes

- Updated dependencies [[`e581f06`](https://github.com/openpatch/hyperbook/commit/e581f06ddb5291528d46ba8c797f5cf8f54072e1)]:
  - @hyperbook/fs@0.7.4

## 0.13.11

### Patch Changes

- [`5bc887d`](https://github.com/openpatch/hyperbook/commit/5bc887dccbeebde8dc0794581d313cc1b35147c7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix dev mode exiting silently.

## 0.13.10

## 0.13.9

## 0.13.8

### Patch Changes

- Updated dependencies [[`17ad5eb`](https://github.com/openpatch/hyperbook/commit/17ad5eb263ce6c45a04482483d2efa3fc1697f76)]:
  - @hyperbook/fs@0.7.3

## 0.13.7

### Patch Changes

- Updated dependencies [[`c6414c8`](https://github.com/openpatch/hyperbook/commit/c6414c8e4c32ec96143a8da4fe8fb0e611ec8c7a)]:
  - @hyperbook/fs@0.7.2

## 0.13.6

### Patch Changes

- Updated dependencies [[`6fa6eba`](https://github.com/openpatch/hyperbook/commit/6fa6eba7b6753ed434c3aa94c713bb9486189c1a)]:
  - @hyperbook/fs@0.7.1

## 0.13.5

### Patch Changes

- Updated dependencies [[`ff21264`](https://github.com/openpatch/hyperbook/commit/ff2126432223b7abefd44c711c42c915ab839d94)]:
  - @hyperbook/fs@0.7.0

## 0.13.4

### Patch Changes

- Updated dependencies [[`6e3fcd5`](https://github.com/openpatch/hyperbook/commit/6e3fcd5616af81f41fb1ff412066f94660ea5cfd)]:
  - @hyperbook/fs@0.6.3

## 0.13.3

### Patch Changes

- Updated dependencies [[`1614352`](https://github.com/openpatch/hyperbook/commit/16143528449b1bfd2d70ab781df66f945b14f3ea)]:
  - @hyperbook/fs@0.6.2

## 0.13.2

### Patch Changes

- Updated dependencies [[`e4712b2`](https://github.com/openpatch/hyperbook/commit/e4712b20601a96e8e6c2c748a3bd3c9719a6d523), [`cad9962`](https://github.com/openpatch/hyperbook/commit/cad99629cae32de462f1145b082f6cc11cbf3cb3)]:
  - @hyperbook/fs@0.6.1

## 0.13.1

### Patch Changes

- Updated dependencies [[`56a42f6`](https://github.com/openpatch/hyperbook/commit/56a42f6a4b67de082fc90b812a248c5b7e004c31)]:
  - @hyperbook/fs@0.6.0

## 0.13.0

### Minor Changes

- [`b134e02`](https://github.com/openpatch/hyperbook/commit/b134e027db1b11cbd0a7e46858dfa60b93c05653) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add more helpers for templates and snippets. See documentation of snippets for more details.

### Patch Changes

- Updated dependencies [[`b134e02`](https://github.com/openpatch/hyperbook/commit/b134e027db1b11cbd0a7e46858dfa60b93c05653)]:
  - @hyperbook/fs@0.5.0

## 0.12.0

### Minor Changes

- [`0c58ad8`](https://github.com/openpatch/hyperbook/commit/0c58ad80c3c8b145868d2c0303d42478ec0a9978) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add templates to Hyperbook. Templates allow for resuing a layout. See the documentation for more details.

### Patch Changes

- Updated dependencies [[`0c58ad8`](https://github.com/openpatch/hyperbook/commit/0c58ad80c3c8b145868d2c0303d42478ec0a9978), [`0c58ad8`](https://github.com/openpatch/hyperbook/commit/0c58ad80c3c8b145868d2c0303d42478ec0a9978)]:
  - @hyperbook/fs@0.4.0

## 0.11.0

## 0.10.0

### Minor Changes

- [`6f24702`](https://github.com/openpatch/hyperbook/commit/6f24702ccf63ee7c6d16d71f81ed9f86e82b00af) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add support for snippets to the hyperbook cli.

### Patch Changes

- Updated dependencies [[`9298af0`](https://github.com/openpatch/hyperbook/commit/9298af040b16836c632e234f6ccbb61d67e1246d)]:
  - @hyperbook/fs@0.3.0

## 0.9.3

### Patch Changes

- Updated dependencies [[`104f2de`](https://github.com/openpatch/hyperbook/commit/104f2de6fa054ecadaf19811c5f8c3c560ca5a64)]:
  - @hyperbook/fs@0.2.0
  - @hyperbook/types@0.5.0

## 0.9.2

### Patch Changes

- Updated dependencies [[`40ec0fd`](https://github.com/openpatch/hyperbook/commit/40ec0fde2cbb2ef823bf11be2b2db365f8c37d9c)]:
  - @hyperbook/fs@0.1.3

## 0.9.1

### Patch Changes

- Updated dependencies [[`af4964b`](https://github.com/openpatch/hyperbook/commit/af4964b7c1c12134a1d08f74d387e8b42844b4a5)]:
  - @hyperbook/fs@0.1.2

## 0.9.0

### Minor Changes

- [`82ee685`](https://github.com/openpatch/hyperbook/commit/82ee685443fcffbbcff8537baf123c823b27c1c9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix: Building hyperlibary with HYPERBOOK_LOCAL_DEV flag.

### Patch Changes

- [`8a3fe07`](https://github.com/openpatch/hyperbook/commit/8a3fe0731dc12e85f89c5905b06f480c1fd1a0ad) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix: Hyperlibrary did not build due to missing setup, even though everything was set up correctly.

- [`4fa6503`](https://github.com/openpatch/hyperbook/commit/4fa650348532f26ff01e4248dab19cb8f47c5ada) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix: hyperbook not building with HYPERBOOK_LOCAL_FLAG

## 0.8.9

## 0.8.8

## 0.8.7

## 0.8.6

### Patch Changes

- Updated dependencies [[`f906c50`](https://github.com/openpatch/hyperbook/commit/f906c5075ec26263f90fabfa2a8ad556619c86da)]:
  - @hyperbook/fs@0.1.1

## 0.8.5

## 0.8.4

## 0.8.3

## 0.8.2

## 0.8.1

### Patch Changes

- [`a0c03e2`](https://github.com/openpatch/hyperbook/commit/a0c03e2338fa3ea5e06a0952a0eb6a16ef9cfdb7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - When platform web has a new version, hyperbook should also get a new version, thus both packages will be released together from now on.

## 0.7.1

### Patch Changes

- [`93c7bd9`](https://github.com/openpatch/hyperbook/commit/93c7bd963ff99af555af2d4112dded50cc6cb759) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Move platform web to devDependency

## 0.7.0

### Minor Changes

- [#392](https://github.com/openpatch/hyperbook/pull/392) [`8d53899`](https://github.com/openpatch/hyperbook/commit/8d538999fc924f7b3e3115416cba4978c9589b68) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Extract core funcationality from platfrom web into separate packages. This helps us to support more platforms.

### Patch Changes

- Updated dependencies [[`8d53899`](https://github.com/openpatch/hyperbook/commit/8d538999fc924f7b3e3115416cba4978c9589b68)]:
  - @hyperbook/fs@0.1.0
  - @hyperbook/types@0.4.0
  - @platforms/web@0.8.0

## 0.6.2

### Patch Changes

- Updated dependencies []:
  - hyperbook-simple-template@0.7.2

## 0.6.1

### Patch Changes

- [`b799b7c`](https://github.com/openpatch/hyperbook/commit/b799b7c26710ee1fc5e59551bb710768829d68cf) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix repo links include full local directory

## 0.6.0

### Minor Changes

- [#371](https://github.com/openpatch/hyperbook/pull/371) [`5a287b2`](https://github.com/openpatch/hyperbook/commit/5a287b25a24c027f65c7b2817f180c1ec395dff9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - # Introducing Hyperlibrary

  A Hyperlibrary is a way to connect multiple Hyperbooks and Hyperlibraries with
  each other. Hyperlibraries are a super flexible way to develop connected
  Hyperbooks.

  A Hyperlibrary is nothing more than a `hyperlibrary.json` files.
  Here is an example for connecting different versions.

  ```json
  {
    "name": "Versions",
    "library": [
      { "src": "v1", "name": "1.0.0", "basePath": "v1" },
      { "src": "v2", "name": "2.0.0", "basePath": "/" }
    ]
  }
  ```

  The folder structure in this case would look like this:

  ```bas
  documention
  | v1
  | | ...
  | | hyperbook.json
  | v2
  | | ...
  | | hyperbook.json
  | hyperlibrary.json
  ```

  As for a Hyperbook, you also have to run the `hyperbook setup` first.
  Afterwards you can use the `hyperbook build` command for building your
  Hyperlibrary.

  The `hyperbook dev` command is not supported with this release. As a workaround you have to start the Hyperbooks as standalones. For example

  ```bash
  user ~/documention $ cd v1
  user ~/v1 $ npx hyperbook dev
  ```

  # CLI Changes

  - `hyperbook setup` does not download the template any more from the GitHub repo, but bundles it. This should decrease bandwidth and improve setup speed.
  - `hyperbook build` and `hyperbook setup` received new command line outputs. This was necessary for not getting lost when using the CLI with a Hyperlibrary.

### Patch Changes

- Updated dependencies [[`5a287b2`](https://github.com/openpatch/hyperbook/commit/5a287b25a24c027f65c7b2817f180c1ec395dff9)]:
  - @hyperbook/types@0.3.0

## 0.5.7

### Patch Changes

- Updated dependencies [[`5ca2ccf`](https://github.com/openpatch/hyperbook/commit/5ca2ccfec72a841ec9c4e43a03ceb2be68710541)]:
  - @hyperbook/types@0.2.0

## 0.5.6

### Patch Changes

- Updated dependencies [[`9472583`](https://github.com/openpatch/hyperbook/commit/947258359e33a39362c070f6c7128f214a79c4c5)]:
  - @hyperbook/types@0.1.0

## 0.5.5

### Patch Changes

- [#316](https://github.com/openpatch/hyperbook/pull/316) [`cedb551`](https://github.com/openpatch/hyperbook/commit/cedb55191fd025b5a214df406a53cbab5d1b1bc1) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Extract Hyperbook types into a separate package

- Updated dependencies [[`cedb551`](https://github.com/openpatch/hyperbook/commit/cedb55191fd025b5a214df406a53cbab5d1b1bc1)]:
  - @hyperbook/types@0.0.1

## 0.5.4

### Patch Changes

- [`23f451f`](https://github.com/openpatch/hyperbook/commit/23f451f9bd8ed8ea54f4403fabb4e8d09fe1a9a9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - replace workspace version with the latest on npm

## 0.5.3

### Patch Changes

- [`9ea5483`](https://github.com/openpatch/hyperbook/commit/9ea5483512fd5134f6823104a68fecea2c50cb00) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Force package update due to failed pipeline

## 0.5.2

### Patch Changes

- [`84bba40`](https://github.com/openpatch/hyperbook/commit/84bba40a449b01bffe5ec86a7fe484cbd4a064e0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix bug requiring admin permissions for creating symlinks #294

## 0.5.1

### Patch Changes

- [`0ce671d`](https://github.com/openpatch/hyperbook/commit/0ce671d61ac57e6526ddecae7e510c06160c174e) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Throw error if archiving fails

* [`d43ec9e`](https://github.com/openpatch/hyperbook/commit/d43ec9e145b1b1b23d2cea5054f9ee0ddd3bc535) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Do not fail if not archives folder is present

## 0.5.0

### Minor Changes

- [`3334df5`](https://github.com/openpatch/hyperbook/commit/3334df5297945b431df01e1f5392db84d7e7d1ff) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add auto archives to supply for example code templates or other files which you
  want to distribute in bulk in a folder. (Single files can still be put into the
  public folder)

  You can put folders inside a `archives` folder in the root of your hyperbook.
  These folders will be zipped and put into the `public` folder. You can easily
  provide the zipped folders by using the `archive` directive.

  ```
  :archive[Download me!]{name="project-1"}
  ```

## 0.4.3

### Patch Changes

- [`0325b9d`](https://github.com/openpatch/hyperbook/commit/0325b9ddce534f7133ff355ca0dbf1f8ddb08437) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Always create next.config.js

## 0.4.2

### Patch Changes

- [`e51a573`](https://github.com/openpatch/hyperbook/commit/e51a573f4bedf540ec9adc53e1111bcf0edc5e4b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add proper error handling and check for updates before each command

## 0.4.1

### Patch Changes

- [`1907ed4`](https://github.com/openpatch/hyperbook/commit/1907ed431f636c966e17a20bee2e2bd5725ff17b) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Use parseAsync insted of parse to fix incorrect exit code

## 0.4.0

### Minor Changes

- [`3ffbfeb`](https://github.com/openpatch/hyperbook/commit/3ffbfebd78012ad8bf0ca2093a322cacfe80a266) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - add creative commons license chooser

## 0.3.0

### Minor Changes

- [`3c2ad77`](https://github.com/openpatch/hyperbook/commit/3c2ad77c106040c9a58b56d87101e438961d49a3) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add bookmarks to default template

## 0.2.1

### Patch Changes

- [`005d429`](https://github.com/openpatch/hyperbook/commit/005d429a761ee33a29e6804fb2957f3a96038dcc) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Ignore typescript errors when building hyperbook. This should be handled by template authors.

## 0.2.0

### Minor Changes

- [`1c8ce7e`](https://github.com/openpatch/hyperbook/commit/1c8ce7e4da5d0707517a8b3e131093d1614df5a7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add basePath option for deploying to subdirectories.

## 0.1.3

### Patch Changes

- [`1bf960b`](https://github.com/openpatch/hyperbook/commit/1bf960bf5843777ee5e47ba0848d45a7ea94e200) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add missing template folder to dist directory

## 0.1.2

### Patch Changes

- [`c5a3fdb`](https://github.com/openpatch/hyperbook/commit/c5a3fdbff48374b303f3fdd1f65949b955c37613) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Add missing files

## 0.1.1

### Patch Changes

- [`b77fc21`](https://github.com/openpatch/hyperbook/commit/b77fc21bf6e098a379c8573dee70aaf1988c0305) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Create symlink for glossary

## 0.1.0

### Minor Changes

- [`ce2282b`](https://github.com/openpatch/hyperbook/commit/ce2282b872493fc525ff7eabde6e7a0d08a4ff67) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Initial release of hyperbook
