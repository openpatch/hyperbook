---
name: Changelog
---

# Changelog

The entire release archive of hyperbook is available on [NPM](https://www.npmjs.com/package/hyperbook)

:::alert{info}

If you need a new feature, open an [issue](https://github.com/openpatch/hyperbook/issues) and let's discuss.

:::

<!--
## v0.41.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Allow emojis in tab titles. E.g.: `:::tab{title="Hi :smile:"}`

:::

:::tab{title="Improved :+1:" id="improved"}



:::

:::tab{title="Fixed :bug:" id="fixed"}



:::

::::
-->

## v0.77.5

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Normalize line-height in code blocks.

:::

::::

## v0.77.4

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix empty pages show up in prev and next navigation

:::

::::

## v0.77.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Hide floating buttons in standalone mode

:::

::::

## v0.77.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix wide styling and line-height

:::

::::

## v0.77.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix emojis not present. Switch to manual updates.

:::

::::

## v0.77.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**New `navigation` Field for Pages and Sections**

A new `navigation` field has been added to control how pages and sections appear in the navigation sidebar.

**For Pages:**
- `navigation: default` - Normal display in navigation
- `navigation: hidden` - Hides the page from navigation (replaces deprecated `hide` field)

**For Sections:**
- `navigation: default` - Collapsible section (default behavior)
- `navigation: hidden` - Hides the section from navigation
- `navigation: virtual` - Items appear at parent level (replaces deprecated `virtual` field)
- `navigation: page` - Renders as a regular page link without showing children - perfect for blog sections!
- `navigation: expanded` - Section is expanded by default (replaces deprecated `expanded` field)

**Example - Blog Section:**
```yaml
---
name: Blog
index: 5
navigation: page
---
```

This renders the blog section as a simple page link in the navigation, respecting the `index` for ordering, while the blog posts inside won't clutter the navigation.

**Breadcrumb Navigation**

A new breadcrumb navigation feature has been added to help users understand their location within the hyperbook structure.

**Global Configuration** in `hyperbook.json`:
```json
{
  "breadcrumb": true
}
```

Or with custom options:
```json
{
  "breadcrumb": {
    "home": ":house:",
    "separator": ">"
  }
}
```

**Per-Page Configuration** in frontmatter:
```yaml
---
breadcrumb: true
---
```

Or disable on specific pages:
```yaml
---
breadcrumb: false
---
```

The breadcrumb supports emoji shortcodes for the home icon and separator (e.g., `:house:`, `:arrow_right:`).

:::

:::tab{title="Improved :+1:" id="improved"}

**Styling Improvements**

- More coherent styling across the hyperbook interface
- Dev server now cleans output folder when files are deleted, preventing stale files from remaining

:::

::::

## v0.76.1

::::tabs

:::tab{title="New :rocket:" id="new"}

- use 1rem as the base font size for better accessibility

:::


::::


## v0.76.0

::::tabs

:::tab{title="New :rocket:" id="new"}



**Title as Alternative to Name**

You can now use `title` as an alternative to `name` in page and section frontmatter. This improves compatibility with other documentation tools like MkDocs that use `title` in their frontmatter.

```yaml
---
title: My Page Title
---
```

If both `name` and `title` are present, `name` takes precedence.

:::

:::tab{title="Fixed :bug:" id="fixed"}

**Navigation Collapsible Symbol Fix**

Fixed an issue where nested collapsible sections in the navigation incorrectly showed a minus symbol (`-`) instead of a plus symbol (`+`) when they were not expanded.

**Typos and Bug Fixes**

- Fixed "Buildung" typo in build progress messages (now correctly shows "Building")
- Fixed "lanuage" typo in error message when an invalid language is configured
- Fixed incorrect MIME type `plain/text` to `text/plain` in development server error responses
- Fixed `aspectRation` typo to `aspectRatio` in excalidraw element configuration types
- Fixed CSS property `aspectRatio:` to `aspect-ratio:` in embed directive (was using JavaScript property name instead of CSS property name)
- Fixed incorrect repository URL in README (`openpath` → `openpatch`)
- Updated minimum Node.js version requirement from 12.22.0 to 18 to match actual requirements

:::

::::

## v0.75.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

**Handlebars helpers in pagelist snippets**

Fixed an issue where handlebars helpers like `dateformat`, `truncate`, and `truncateWords` were not available when using custom snippets with the pagelist directive.

Note: File-related helpers (`file`, `rfile`, `base64`, `rbase64`) are not available in pagelist snippets.

:::

::::

## v0.75.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**New Handlebars Helpers**

Three new helpers for snippets and templates:

- **dateformat**: Format dates with customizable patterns
  ```hbs
  {{dateformat "2026-01-09" "DD.MM.YYYY"}}  → 09.01.2026
  ```
  Supports: `YYYY`, `YY`, `MM`, `M`, `DD`, `D`, `HH`, `H`, `mm`, `m`, `ss`, `s`

- **truncate**: Truncate strings by character limit
  ```hbs
  {{truncate "Hello World" 5 "..."}}  → Hello...
  ```

- **truncateWords**: Truncate strings by word count
  ```hbs
  {{truncateWords "one two three four" 2 "..."}}  → one two...
  ```

:::

::::

## v0.74.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**Enhanced Pagelist Query Language**

The pagelist element now supports a powerful query language for filtering pages:

- **Boolean operators**: Combine conditions with `AND`, `OR`, `NOT`
- **Parentheses**: Group conditions for complex queries like `(href(/blog/.*) OR href(/news/.*)) AND keyword(featured)`
- **Custom frontmatter fields**: Query any frontmatter field like `difficulty(beginner)` or `tags(tutorial)`
- **Operator precedence**: `NOT` > `AND` > `OR`

**New Parameters:**
- `limit`: Limit the number of results (e.g., `limit="5"`)
- `orderBy`: Sort by any field including custom frontmatter (e.g., `orderBy="date:desc"`)

**Example:**
```md
::pagelist{source="href(/blog/.*) AND date(.*)" orderBy="date:desc" limit="5"}
```

:::

:::tab{title="Improved :+1:" id="improved"}

- Date objects from YAML frontmatter (e.g., `date: 2025-01-09` without quotes) now work correctly for filtering and sorting in pagelist.

:::

::::

## v0.73.5

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Add emoji support to tiles.

:::

::::

## v0.73.4

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix duplicate entries in pagelist.

:::

::::

## v0.73.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix resolving relative files, when using an index.md in a directory.

:::

::::

## v0.73.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix Typst styling. Only the page is now colored white.

:::

::::


## v0.73.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**Typst Directive**

Write and preview Typst documents directly in your Hyperbook with a powerful interactive editor.

**Features**
- Interactive editor with syntax highlighting
- Live preview with automatic rendering
- Multi-file project support with tab interface
- Binary file upload for images, fonts, and other assets
- Export to PDF
- Download entire project as ZIP
- State persistence across page reloads

**Smart Error Handling**
- Error messages display as dismissible overlays in the preview
- Last successful render is preserved when errors occur
- Clean, readable error messages extracted from Typst compiler output
- Smooth animations with visual feedback

:::

::::

## v0.72.2

::::tabs

:::tab{title="Improved :+1:" id="improved"}

**Improved Accessibility and No-JavaScript Support**

Your Hyperbook now works even when JavaScript is disabled or unavailable, making it more accessible and reliable.

**What's New**
- Navigation, collapsibles, and tabs now work without JavaScript
- Cleaner interface when JavaScript is disabled - unnecessary buttons are hidden
- Improved keyboard navigation throughout the site
- Better compatibility with screen readers and assistive technologies

**Benefits for Your Readers**
- ✅ Content always accessible, even with JavaScript disabled
- ✅ Better experience for users with slow connections
- ✅ Improved SEO - search engines can see all your content
- ✅ Enhanced accessibility for users with disabilities
- ✅ Faster initial page load
- ✅ More reliable navigation

:::

::::


## v0.72.1

::::tabs

:::tab{title="Improved :+1:" id="improved"}

Performance optimizations

- Added `font-display: swap` to all font-face declarations for better page load performance
- Added `defer` attribute to script tags to improve page load speed
- Minified dexie-export-import.js bundle to reduce file size
- Added explicit height attribute to logo image for better CLS scores

:::

::::


## v0.72.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

Add shareable URL builder with sections filter

- Added share button (🔗 icon) in header that opens a dialog for creating shareable URLs
- Implemented sections filter query parameter to show only specific content sections
- Added live URL preview with standalone mode toggle and section selection checkboxes
- QR code now includes all query parameters in the generated code
- TOC toggle hides automatically when sections are filtered
- Floating action buttons (TOC, QR code) now use dynamic flexbox positioning
- Both share and QR dialogs moved outside content area to remain visible when filtering

:::

:::tab{title="Fixed :bug:" id="fixed"}

- Multievent is hidden on page load and gets shown when the javascript is loaded, thus not revealing the solutions.

:::

::::

## v0.71.4

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Update pyodide to version 0.29.0

:::


::::

## v0.71.3

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Update learningmap

:::


::::

## v0.71.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Improve the new command and make it accessible via `npx create hyperbook` and in the vs code extension.

:::


::::


## v0.70.1

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Update dependencies:
  - learningmap to 0.3.0
  - abcjs to 6.5.2
  - jsxgraph to 1.12.0
  - mermaid to 11.12.1
  - p5 to 2.1.1
  - wavesurfer.js to 7.11.1

:::

## v0.70.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Support relative links for prev and next in the frontmatter. You can now use relative links for the previous and next buttons in the frontmatter like so:

```yaml
prev: ../previous-page.md
next: ./next-page.md
```

:::

## v0.69.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- The previous and next button are now always enabled, even if hide is true. You have to manually disable them in the frontmatter like so:

```yaml
prev:
next:
```

:::

## v0.68.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fixed images have doubled base paths.

:::

## v0.68.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Learningmaps not loading from relative urls.
- **VSCode Extension (v0.44.1)**: Fix learningmap with relative src not loading in VSCode extension preview. The extension now properly resolves relative paths by correctly passing navigation context to the markdown processor.

:::

::::

## v0.68.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- The `::multievent` directive now fully persists its state, including all visual feedback from evaluations. When users reload the page, they can see whether their task was evaluated as correct or incorrect, with all green highlighting for correct answers, orange striped backgrounds for incorrect answers, and error indicators preserved. State is saved automatically on all interactions and restored on page load.

:::

::::

## v0.67.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Add new `custom` table to the Hyperbook Dexie store for user-managed state persistence. Users can now store and retrieve arbitrary JSON data in the browser's IndexedDB using `store.custom.put()` and `store.custom.get()`. Custom data is automatically included in export/import functionality. [Learn more](/advanced/custom-scripts#using-the-hyperbook-store-api)

:::

::::

## v0.63.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Add new `::textinput` directive for persistent text input. This directive creates interactive text input areas that automatically save to the browser's local storage using Dexie. Supports customizable placeholder and height attributes, multiple independent inputs via custom IDs, and full light/dark mode theming. [Learn more](/elements/textinput)

:::

::::

## v0.62.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix relative urls for sqlite.

:::

::::

## v0.62.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix SQLIde not loading custom database files.

:::

::::

## v0.62.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Use Learningmap web component from the new "@learningmap/web-component" package. This is best used together with the new Learningmap editor. [Learn more](/elements/learningmap)

:::

::::

## v0.61.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Changed last fix to keep backward compatibility.

:::

::::

## v0.61.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fixed GeoGebra not loading the correct file.

:::

::::

## v0.61.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fixed an issue where the width and height of nodes were not being saved correctly in Learning Maps.
- Improved button labels for topics in Learning Maps for better clarity and usability.
- Resolved a bug that prevented the "needs" and "optional" properties from being set in the Learning Maps editor.

:::

::::

## v0.61.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- **Page Layout Options**: Added three layout options for Hyperbook pages:
  - **Default Layout**: Standard layout with visible sidebar (unchanged behavior for existing pages)
  - **Wide Layout**: Full-width content with drawer-only navigation, ideal for data tables, code examples, and galleries. [Learn more](/advanced/layouts)
  - **Standalone Layout**: Content-only display (no header, sidebar, footer) perfect for iframe embedding. [Learn more](/advanced/layouts)
- **Automatic Iframe Detection**: Pages automatically switch to standalone mode when embedded in iframes - zero configuration needed!
- **Three Activation Methods for Standalone**: Can be activated via frontmatter (`layout: standalone`), URL parameter (`?standalone=true`), or automatic iframe detection
- **Smart UI Hiding**: TOC toggle and QR code buttons automatically hide in standalone mode for cleaner embedded experience
- **Backward Compatible**: All existing pages work unchanged without any configuration

:::

::::

## v0.60.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Vastly improved learningmap element for displaying interactive learning maps. [Learn more](/elements/learningmap)
- **Automatic Favicon and PWA Icon Generation**: When building a Hyperbook project, if no `favicon.ico` exists and a `logo` is defined in `hyperbook.json`, a complete set of favicons and PWA assets are automatically generated (60+ files including Android icons, Apple touch icons, Apple startup images, and web manifest with full metadata). The system intelligently searches for logos in the root folder, book folder, or public folder, and uses metadata from `hyperbook.json` (name, description, theme color, language, author) to create a professional PWA-ready icon set.

:::

::::

## v0.58.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Retain scroll position in dev-mode when the page is reloaded.

:::

::::

## v0.58.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix url in learningmaps not prefixed with basePath.

:::

::::

## v0.58.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Add learningmap element to create interactive learning maps. [Learn more](/elements/learningmap)

:::

::::

## v0.57.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fixed IDEs not showing all characters correctly.

:::

::::

## v0.57.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fixed alert element not working correctly in container elements like tabs.

:::

::::

## v0.57.1

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Horizontal rule not break image aligment.
- Collapsibles and alerts work better with image alignment.

:::

::::

## v0.57.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Auto load math display libraries in all h5p elements.
- Add c and l variables to allow for dynamic amount of colons in snippets.

:::

::::

## v0.56.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Use alert colors for links, headings and bold text.

:::

::::

## v0.55.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Custom alerts can now be defined. See the documentation for [alerts](@alerts).

:::


::::

## v0.54.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Add custom image attributes support using curly brace syntax `{}`. Example: `![](/image.jpg){#hero .rounded width="200"}` adds ID `hero`, class `rounded`, and sets width to 200px.
- Add enhanced image alignment options with special characters:
  - `![](/image.jpg)` - Center (default)
  - `-![](/image.jpg)` - Left aligned
  - `--![](/image.jpg)` - Left aligned with extended spacing
  - `![](/image.jpg)-` - Right aligned  
  - `![](/image.jpg)--` - Right aligned with extended spacing
  - `--![](/image.jpg)--` - Center with extended spacing
- Add comprehensive image styling documentation with live examples.

:::

:::tab{title="Improved :+1:" id="improved"}
- Improve lightbox to eliminate layout shifts when opening/closing.
- Improve lightbox rendering performance and smoother transitions.
:::

::::

## v0.53.7

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
- Fix sub and superscript interfering with links and other markdown syntax.
- Convert mjs to js for better compatibility.
:::


::::

## v0.53.6

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
- Fix toc configuration not working correctly.
:::


::::

## v0.53.5

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
- Fix toc and qrcode configuration not working correctly.
:::


::::

## v0.53.4

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Update emoji shortscodes to match GitHub's emoji shortcodes. This means that you can now use the same shortcodes as on GitHub, e.g. `:smile:` for 😄.

:::


::::

## v0.53.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
- Fix headings with colons did not display correctly.
- Fix files with spacing in the name did not work correctly.
:::

:::tab{title="Improved :+1:" id="improved"}

- Allow syntax highlighting and copy code to be disabled for inline code blocks. For this you have to set the `bypassInline` options in your `hyperbook.json` to `true`.

:::


::::

## v0.53.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
- Build does not crash anymore, when an empty index.md is present.
:::

::::

## v0.53.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
- Fix sections need an index.md. Folders without an index.md are now ignored.
:::

::::

## v0.53.0

::::tabs

:::tab{title="New :rocket:" id="new"}
You can now include images, videos, and other files directly within your book directory, making it easy to reference them using relative paths. This greatly improves your ability to:

- Organize content intuitively

- Collaborate with others

- Share Hyperbook pages with media included

Example usage:

```md
![Image in the same directory](./image.png)  
![Image one directory up](../image.png)
```

This change enables a more seamless and portable authoring experience—no need to manage separate static folders or rely on absolute paths.

**🧩 Smarter Link Handling**
You can now link to files with .md, .md.json, and .md.yml extensions. This improves compatibility with editor-based file completion, making navigation and linking easier during editing.

**⚠️ BREAKING CHANGE**
To support these features, the template file extension format has changed:
If a book page is defined in YAML or JSON, it must now use:

- .md.yml instead of .yml

- .md.json instead of .json

This ensures the markdown parser can correctly process the content and resolve relative paths to media.

:::

::::

## v0.52.7

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
- Do not parse e.g. :1 as a element. Only parse the documented elements.
:::

::::

## v0.52.6

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
  - Fix QR Code not showing correctly, because escaped characters were used.
:::

::::

## v0.52.5

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
  - CLI argument port was not used. Now it is working again. For example: `hyperbook dev --port 3000`
:::

::::

## v0.52.4

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}
  - Dev server was not respecting the `basePath` configuration option. Now it is working again.
:::

::::

## v0.52.3

::::tabs

:::tab{title="Improved :+1:" id="improved"}
  - Default to youtube-nocookie for youtube videos.
:::

::::

## v0.52.2

::::tabs

:::tab{title="Improved :+1:" id="improved"}
  - Improve table responsive design.
:::

::::

## v0.52.1

::::tabs

:::tab{title="Improved :+1:" id="improved"}
- Update dependencies
    - P5 to version 2.0.0
    - Excalidraw to version 0.18.0
    - Mermaid to version 11.6.0
:::

:::

::::

## v0.52.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}
- A new element multievent that allows you to handle multiple events in a single interactive component. This feature is particularly useful for creating quizzes and other complex interactive scenarios where a single user's answers are evaluated directly with immediate feedback on whether they are correct or not. [Learn more](/elements/multievent)
:::

:::

::::

## v0.51.1

::::tabs

:::tab{title="Improved :+1:" id="improved"}

Styling Improvements:
- Increased the width of the navigation to utilize more horizontal space.
- Reduced base font size to 14px for improved readability and a more compact layout.
- Decreased header height to 60px to maximize vertical content space.

:::

::::

## v0.51.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- In addition to GeoGebra you can now use JSXGraph for creating math visualizations. [Learn more](/elements/jsxgraph)

:::

::::

## v0.50.5

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- The development server does not crash anymore, when an error occurs.

:::

::::

## v0.50.4

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- The GeoGebra reset button now resets the GeoGebra element to its initial state.

:::

::::

## v0.50.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix GeoGebra element not resize correctly in collapsibles, again.

:::

::::

## v0.50.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix GeoGebra element not resize correctly in collapsibles.

:::

::::

## v0.50.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Improve responsive scaling of the GeoGebra element.
- Save and load the state of the GeoGebra element.

:::

::::

## v0.50.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- The h5p element allows you to embed H5P content directly into your hyperbook. H5P is an open-source platform for creating, sharing, and reusing interactive content. With the h5p element, you can easily integrate H5P content such as quizzes, interactive videos, and presentations into your hyperbook. [Learn more](/elements/h5p)

:::

::::

## v0.49.4

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Update mermaid to 11.4.1
- Update p5 to 1.11.3
- Update wavesurfer.js to 7.9.0

:::

::::

## v0.49.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix missing right border in the struktog element

:::

::::


## v0.49.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Add footnote translation for german.

:::

::::

## v0.49.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix collapsibles not having a default id and therefore not working correctly.

:::

::::

## v0.49.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Make hyperbook config accessible in snippets.

```md
{{ hyperbook.name }}
```

:::

::::

## v0.48.8

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix p5 element not accepting editor=false.

:::

::::

## v0.48.7

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix sections collapsing before navigating to the new URL.
- Fix active sections not using the brand color.

:::

::::

## v0.48.6

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Remove p5.sound. The library caused the p5-element to stay in the loading stage in Safari for iOS and MacOS.
- Fix the parsing of snippet parameters. Snippet parameters can now include parentheses and other symbols.

:::

::::

## v0.48.5

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix link to section not including the basePath.

:::

::::

## v0.48.4

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix build breaking, when a heading is in a collapsible.

:::

::::

## v0.48.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Remove unwanted `console.log`.

:::

::::

## v0.48.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix search not working.

:::

::::

## v0.48.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix collapsible button styles bleeding into other button styles.

:::

::::

## v0.48.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- The webide element allows you to embed a web-based integrated development environment (IDE) directly into your hyperbook. This feature is particularly useful for interactive coding tutorials and exercises, enabling users to write and run code within the book itself. [Learn more](/elements/webide)

:::

::::

## v0.47.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix tabs and collapsibles not rendering hyperbook elements.

:::

::::

## v0.47.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Development server injected the reload script at the wrong place, if there was an additional body tag. Thus, leading to unwanted behavior e.g. for the p5-element.
- Pyide: The event listener for the run button was not removed, which lead to refreshing the page when the run button was clicked multiple times.

:::

::::

## v0.47.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Save every state of the hyperbook and make it available for download. To enable this feature, set `importExport` to `true` in the configuration file. The buttons for importing and exporting will be at the bottom of the page. The state of the hyperbook will be saved as a JSON file. The file can be imported again to restore the state of the hyperbook. 
- The code of the editor for the elements P5, Pyide, ABC-Music can now be copied, download or resetted.
- Add i18n support. Currently, only `en` and `de` are supported. You need to set the `language` in the configuration file. [Learn more](/configuration/book) 
    - If you want to contribute a new language, please create a pull-request and add a new locale in `packages/markdown/locales`.

:::

::::

## v0.46.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Resolved an issue where interactive elements failed to initialize correctly after being revealed within the protect element.
- Fixed an issue where collapsibles with the same ID were not synchronized.

:::

::::

## v0.46.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Resolved an issue where interactive elements failed to initialize correctly after being revealed within the protect element.
- Fixed an issue where collapsibles with the same ID were not synchronized.

:::

::::

## v0.46.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Add `trailingSlash` option. When this option is enabled only directories and `index.html` files will be produced, when building the hyperbook. [Learn more](/configuration/book)

:::

::::

## v0.45.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- You can now add inputs and tests to your pyide element. [Learn more](/elements/pyide)

:::

::::

## v0.44.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- A new element pyide that allows you to run python in your browser. [Learn more](/elements/pyide)

:::

::::

## v0.43.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- A new element p5 that allows you to create p5.js sketches was added. [Learn more](/elements/p5)

:::

::::


## v0.42.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Add abc-music element for creating and listing to note written in the abcnotation. [Learn more](/elements/abc-music)

:::

::::

## v0.41.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Allow emojis in tab titles. E.g.: `:::tab{title="Hi :smile:"}`

:::

::::
