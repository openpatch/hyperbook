---
name: Changelog
index: 1
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

## v0.107.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**jmp**: A new `::jmp{src="memory.jmp"}` element embeds the [Java Memory Playground](https://jmp.openpatch.org) — a diagram of the stack and the heap that a reader can take apart and rebuild. It reads a `.jmp` file, the same JSON the playground shares in a link, and the playground's display options can be overridden per embed, so `::jmp{src="memory.jmp" hide-sidebar disable-garbage-collector}` turns the same file into a figure to look at rather than a canvas to work on. What a reader builds is kept as they work, without them having to press Save, and a button in the corner puts your diagram back.

:::

:::tab{title="Improved :+1:" id="improved"}



:::

:::tab{title="Fixed :bug:" id="fixed"}



:::

::::

## v0.106.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**check**: A new `hyperbook check` command goes over a book without building it and reports links and images that point at nothing, two pages claiming the same `permaid`, and options in `hyperbook.json` that Hyperbook does not know about. A mistyped option is otherwise ignored in silence, and a broken link only shows up when a reader clicks it. It exits with an error, so it can run in CI ahead of `hyperbook build`.

**print**: Books can be printed. There was no print stylesheet before, and because the reading layout is a fixed grid whose article pane scrolls, printing a chapter gave you roughly one sheet. Now the whole chapter comes out: the navigation and buttons are dropped, collapsed sections and every tab of a tab group are opened, dark mode is not carried onto paper, and an answer a reader has typed into a `::textinput` prints in full rather than being cut off at the edge of the box.

:::

:::tab{title="Improved :+1:" id="improved"}

**search**: Pages load a great deal faster. The search index was linked from every page whether or not the reader ever opened search — on this documentation that was 2.9 MB of the 3.1 MB of JavaScript each page pulled in. It is fetched the first time someone searches now, which leaves 284 KB. Search itself got quicker too, because the index is read once instead of on every keystroke, and it now searches as you type. Press `/` anywhere to open it.

**diagnostics**: The build tells you when a directive is written with the wrong number of colons. Messages like `Unexpected "::alert" leaf directive, use three colons` were being worked out on every build and then thrown away. They now appear with the file and line while you build, in `hyperbook dev` both in the terminal and over the page in the browser, and as squiggles in the VS Code preview. `hyperbook dev` also shows build errors in the browser instead of only in the terminal, where they were easy to miss.

**directives**: Directives now accept every form they actually support. `geogebra`, `struktolab`, `p5` and the code editors `pyide`, `webide`, `typst` and `openscad` take either a body or an attribute — an editor with no body is how you set a blank exercise — and `archive` and `download` work inside a sentence as well as on their own. Each of those used to insist on one form and call the other a mistake.

:::

:::tab{title="Fixed :bug:" id="fixed"}

**textinput and other interactive elements**: Editing a page no longer wipes what readers have written into it. The id an element stored its data under was worked out from a hash that included where the element sat in the file, so adding a paragraph anywhere above a `::textinput` gave it a new id and every answer already written into it was silently orphaned. Ids now come from the element itself, and books built with an earlier version are migrated the first time a reader opens them. Two elements on a page that are written exactly alike are the one case this cannot separate — they are told apart by their order — so the build now warns about them and asks you to give each an `id`.

**accessibility**: A book with no `language` set was announced as Spanish by screen readers. The search field also had no placeholder and no label.

**hyperbook.json**: A syntax error in `hyperbook.json` now names the line it is on. It used to say `Missing or invalid hyperbook.json/hyperlibray.json` and leave you to find it.

**dev**: `hyperbook dev -p 3000` searched from port 30001 when 3000 was already taken. The notice telling you a new version of Hyperbook is available could never appear.

:::

::::

## v0.105.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**protect**: Protected content is really protected now. It is encrypted while your book is built, with a key derived from the password, and the browser decrypts it once a reader enters that password. Neither the content nor the password is in the page any more — before, both were, and anyone could read them from the page source. Blocks can be nested: the inner one is encrypted first, so an outer password opens only the outer layer.

**protect**: A whole page or a whole section can be protected, by putting `protect` in its frontmatter instead of wrapping the content in a block. A section passes it down to every page and subsection inside it, so pages you add to the folder later are covered without you having to remember. One password opens the whole section — readers enter it once, not on every page. Protected entries stay in the navigation and get a lock next to their name.

**passwords**: Passwords can live in a `passwords.json` next to your `hyperbook.json` and be used by name, with `use="chapter-3"` on a protect block or `protect: chapter-3` in frontmatter. You then change a password in one place, and the file can stay out of your repository: the values can come from `HYPERBOOK_PASSWORDS_FILE`, `HYPERBOOK_PASSWORDS` or `HYPERBOOK_PASSWORD_<KEY>` instead. A name with no value stops the build rather than falling back to an empty password.

**passwords**: A new `hyperbook passwords` command shows every password a book uses and where. `list` prints them, `init` writes the registry and can generate the passwords for you, and `check` fails when a name has no value — useful in CI before `hyperbook build`.

**passwordlist**: A new element puts that same overview on a page, for a teacher's copy of the book. It can be narrowed to the current page, the current section or a pattern. Read the warning in its documentation first: it prints passwords into the built page.

:::

:::tab{title="Improved :+1:" id="improved"}

**protect**: Unlocking is now an explicit step — an Unlock button, or Enter — and a wrong password says so. Deriving the key from the password takes a moment, which is what makes guessing passwords expensive, so it can no longer happen on every keystroke.

:::

:::tab{title="Fixed :bug:" id="fixed"}

**protect**: Protected content no longer reaches the search index. The index stores the full text of everything it covers, so until now the content of every protected block was sitting in `search.js`, readable without any password. It is also kept out of `llms.txt`, and headings inside a protected block no longer appear in the table of contents.

**emoji**: Emoji shortcodes no longer fall back to the reader's own emoji font when you use the `twemoji` style. 616 of the 1913 shortcodes did, so a page mixed two different emoji styles — flags, keycaps and emoji like `:comet:`, `:asterisk:` and `:airplane:` were all affected. Every shortcode now has a Twemoji image. The names are unchanged, so nothing you have written needs to change.

:::

::::

## v0.104.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

**online-ide**: Update online-ide to newest version.

:::

::::

## v0.104.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

**online-ide**: Update online-ide to newest version.

:::

::::

## v0.104.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

**webide**: The preview cut off the bottom of its content. The frame claimed the full height of its box instead of the space left below the title bar, so it hung over the lower edge and the part underneath was clipped — about 40 pixels, no matter which `height` you set on the block. Scrolling did not reach it either, because the frame did not know it was too tall. A preview now ends where its box ends.

:::

::::

## v0.104.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

**dependencies**: All dependencies are updated to their latest versions. Among them Shiki 4 for syntax highlighting, Mermaid 11.16, three.js 0.185, p5 2.3, Excalidraw 0.18.1 and React 19.2. The rendered output of your book stays the same.

**hyperbook-studio**: The extension now requires VS Code 1.125.0 or newer.

:::

::::

## v0.103.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**online-ide**: The IDE takes its theme from the book's dark mode toggle and follows it when a reader flips it.
**sql-ide**: The IDE takes its theme from the book's dark mode toggle and follows it when a reader flips it.

:::

:::tab{title="Improved :+1:" id="improved"}

**online-ide**: The IDE's own fullscreen buttons are shown instead of the separate button below it. Escape leaves fullscreen again.

:::

::::

## v0.102.1

::::tabs

:::tab{title="Improved :+1:" id="improved"}

**online-ide**: Update online-ide to newest version.

:::

::::

## v0.102.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**navigation**: A section can sit between two pages, and a page can sit after a section. This works at every level, so a subsection can sit between two pages of its section. The `index` of a page and the `index` of a section are one order now, instead of pages always coming first. Without an `index` nothing moves: pages still come before sections.

:::

:::tab{title="Improved :+1:" id="improved"}

**navigation**: The pages of a section are indented, so they read as belonging to it when a page of the level above follows them.

:::

:::tab{title="Fixed :bug:" id="fixed"}

**shell**: The search and table of contents drawers no longer flash over the page for a moment while it loads.

**shell**: Pages paint sooner. The script that loads the light and dark stylesheets is part of the page now, instead of a file that had to be fetched before anything could be drawn.

:::

::::

## v0.101.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**emoji**: Emojis can be rendered as images, so they look the same on every platform instead of being drawn with the emoji font of the reader's operating system. Set `elements.emoji.style` to `twemoji` in your `hyperbook.json`. Only the emojis your book uses end up in your build.

:::

:::tab{title="Improved :+1:" id="improved"}

**bookmarks**: The bookmark icon is drawn by the stylesheet instead of being an emoji. It looks the same everywhere, takes the color of its heading, and a saved bookmark shows a filled icon.

**bookmarks**: An entry in the bookmark list shows the same emojis as the heading it points at. If you call `hyperbook.ui.toggleBookmark` yourself, it no longer takes a label.

:::

:::tab{title="Fixed :bug:" id="fixed"}

**markdown**: `mailto:` and `tel:` links in your content kept the base path of the book in front of them, so `[Write us](mailto:hi@example.org)` became `/mailto:hi@example.org`.

**bookmarks**: A heading that contains a quote or a backslash can be bookmarked again.

:::

::::

## v0.100.5
::::tabs

:::tab{title="Improved :+1:" id="improved"}

- onlineide: Update to support java 25 syntax.

:::

::::

## v0.100.4

::::tabs

:::tab{title="Improved :+1:" id="improved"}

**cloud**: The sync indicator tells its states apart by shape, not only by color. Every state previously drew the same person icon in a different shade, which made "unsynced" and "synced" indistinguishable for red-green color blind readers. The toolbar button now also carries the current state as its accessible name, and the status line is announced when it changes.

**cloud**: States you can act on are surfaced outside the user drawer. A failed save, being offline, or a merge with another session now appear in a notice at the bottom of the page — with a retry button for a failed save, and a count of how much is still waiting while offline. Successful saves stay silent.

**cloud**: A sync conflict explains itself before reloading. The page still has to reload so interactive elements pick up the merged state, but it is announced first, with a **Reload now** button, instead of happening without warning.

**cloud**: The status line reports how long ago the last save landed.

:::

:::tab{title="Fixed :bug:" id="fixed"}

**cloud**: Loading from the cloud failed whenever the server held events but no snapshot yet. The failure was silent, so work synced up but never came back down — on a second device, after clearing browser data, or during a conflict merge — until something happened to upload a full snapshot.

**cloud**: A sync conflict no longer discards local work. The client fetches the server state, replays its pending changes on top of it both locally and on the server, and only then reloads.

**cloud**: Changes made offline are no longer lost on reconnect. Every queued batch after the first carried an event ID recorded before the flush, so the server rejected it and the whole queue was discarded.

**cloud**: Closing the tab no longer loses changes made in the last few seconds. Saves are debounced by up to two seconds, and nothing was sent when the page went away — it only warned. Pending changes are now flushed with a request that outlives the page.

**cloud**: Two hyperbooks served from the same domain no longer share one sync counter, which put both into a permanent conflict loop.

**cloud**: The server keys rows by each table's own primary key. Tables not keyed by `id` — bookmarks, online IDE scripts, SQL IDE databases — were rewritten with a bogus `id` field, and updates and deletes against them silently missed.

**cloud**: Replaying the same events twice no longer duplicates rows, and updates to nested fields (such as a saved zoom level) are no longer dropped.

**cloud**: Cursor position, scroll offset and window size are no longer uploaded, so one device no longer pulls another's scroll position.

**cloud**: A change the server rejects is dropped instead of being retried forever, which used to block every later change behind it.

:::

::::

## v0.100.2

::::tabs
:::tab{title="Improved :+1:" id="improved"}

- onlineide: Update to the latest version. It fixes some bugs in the scratch implementation.

:::
::::

## v0.100.1

::::tabs
:::tab{title="Improved :+1:" id="improved"}

- onlineide: Update to the latest version. It now supports scratch-for-java programs. 

:::
::::

## v0.100.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**pyide**: The editor now autocompletes the `turtle` module. Every function it provides is offered with its signature and a short description, both for `from turtle import *` and for member access on `turtle`, a `Turtle()` or a `Screen()`. Suggestions only appear once a script imports turtle, and never inside comments or strings.

**turtle**: The module gained the screen and turtle functions it was missing:

- Program flow: `done`, `mainloop`, `exitonclick`, `bye`, `Screen`, `getscreen`
- Drawing control: `tracer`, `update`, `delay`, `undo`, `setundobuffer`, `undobufferentries`
- Stamps: `stamp`, `clearstamp`, `clearstamps`
- Geometry and angles: `distance`, `mode` (standard and logo), `degrees`, `radians`, `filling`
- Cursor: `shapesize`/`turtlesize`, `tilt`, `tiltangle`, `settiltangle`, `register_shape`/`addshape`
- Screen: `setup`, `title`, `clearscreen`, `resetscreen`, `window_width`, `window_height`
- Interaction: `numinput`, `textinput`, `listen`, `onkey`, `onkeypress`, `onkeyrelease`, `onclick`, `onscreenclick`, `ontimer`

`tracer(0)` also skips the animation queue, so the usual "draw everything, then `update()`" pattern is fast instead of appearing to hang.

:::

:::tab{title="Improved :+1:" id="improved"}

**pyide**: `input()` no longer freezes the page. Python runs on the browser's main thread, so the old `window.prompt()` blocked it — everything a script had drawn stayed invisible until the program finished. Input is now read from a field in the output panel while Python is suspended, so the canvas keeps painting and queued turtle animation keeps draining while a script waits. This needs WebAssembly JSPI (Chrome and Edge 137+); other browsers keep the previous dialog.

```python
from turtle import *

# The board is now visible while the program asks.
for i in range(12):
    dot(40)
    forward(50)
karte = int(input("Which card? "))
```

The output panel reads like a terminal too: the prompt, the answer that was typed, then a newline.

**turtle**: `turtle.numinput()` and `turtle.textinput()` use the same field, and follow CPython in asking again when the answer is not a number or falls outside `minval`/`maxval`.

**navigation**: A section that links to its own page is now easy to tell apart from one that only expands. Sections with an empty `index.md` are set in italics, and the title of a section that has its own page underlines on hover to show that it is a link. Subsections are judged on their own content, not on their parent's. The highlight for the section you are currently on works again — the stylesheet was still looking for `active` on the `<summary>` element, which moved to the surrounding `<details>` when sections became collapsible.

**dev**: `hyperbook dev` now knows which files each page pulls in, so saving a file rebuilds exactly the pages that used it. Editing a script referenced by a directive's `src=` attribute used to reload the browser without rebuilding the page, which brought back the old content; a file under `book/` did nothing at all. Snippets and templates now rebuild only the pages that include them rather than the whole book. Renaming a page also refreshes the navigation everywhere instead of only on the page you edited, and the search index no longer goes stale between full builds.

**pyide**, **p5**, **openscad**, **webide**, **typst**, **abc-music**: The reset, copy, download and fullscreen buttons in the editor toolbar are now icons instead of written labels, which wrapped onto several lines in languages with long words. The wording becomes the tooltip, and is still announced by screen readers.

Directive icons are now drawn as SVG throughout — the download icons in **download** and **archive**, the lock in **protect**, typst's add-file button and the expand arrows on the binary-file sections. Typst's two download buttons are told apart by their icons: a box for the whole project, a document for the PDF. They follow the light and dark themes, and the fullscreen button no longer renders as an empty box on systems whose fonts lack `⛶`.

:::

:::tab{title="Fixed :bug:" id="fixed"}

- **turtle**: `begin_fill()` and `end_fill()` drew nothing. Every vertex of the fill collapsed onto the turtle's final position, and fills painted over the lines drawn during them instead of underneath.
- **turtle**: Reading a pen setting destroyed it — `pensize()`, `pencolor()`, `fillcolor()`, `color()` and `speed()` without arguments reset the pen instead of returning the current value.
- **turtle**: `clear()` called during a fill left the turtle unable to fill for the rest of the program, and also reset the pen width. `speed()` carried over into the next run of a program.
- **turtle**: `circle()` ignored its `extent` argument, so arcs were impossible. The signature is now `circle(radius, extent=None, steps=None)`, and a negative radius curves to the right.
- **turtle**: `pencolor(r, g, b)` and `color(r, g, b)` produced black, and `speed("slowest")` and the other named speeds selected the fastest setting.
- **turtle**: The turtle cursor ignored `fillcolor`, `towards()` rejected a coordinate pair, and `shape()` silently ignored an unknown shape name instead of raising.

:::

::::

## v0.99.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- **openscad**: Fix 3MF export to split geometry into separate objects by color, enabling proper multicolor prints in slicers like BambuStudio and PrusaSlicer.

:::

::::


## v0.99.0

::::tabs

:::tab{title="New :rocket:" id="new"}

**links*: Links now support extensions:

• `[Hallo](./hallo.md)` → resolves to /hallo
• `[Hallo](./hallo)` → resolves to /hallo
• `[Template](./template.md.hbs)` → resolves to /template
• `[Data](./data.md.json)` → resolves to /data
• `[Config](./config.md.yml)` → resolves to /config

**Kiri:Moto**: Embed the browser-based 3D slicer [Kiri:Moto](https://grid.space/kiri) in any hyperbook page using the new `::kirimoto` directive.

```md
::kirimoto{mode="FDM" settings="1qzciqo/3"}
```

Supported attributes: `height`, `mode`, `model`, `workspace`, `settings`. Global defaults for `height` and `settings` can be configured in `hyperbook.json`:

```json
{
  "elements": {
    "kirimoto": {
      "height": "700px",
      "settings": "13b1vam/1"
    }
  }
}
```

:::

::::

## v0.98.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- **openscad**: Fix unclear error messages — empty files no longer show `[object Object]`, and line numbers in parser errors are now correctly adjusted to match the user's code.

:::

::::

## v0.98.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- **openscad**: Fix axes in openscad to match the standard OpenSCAD orientation (X right, Y forward, Z up) instead of the previous incorrect orientation.

:::

::::

## v0.98.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- **openscad**: Add gizmo and grid for better navigation in 3d space.

:::

::::

## v0.97.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- **openscad**: Add binary file support.

:::

::::

## v0.96.3

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- **openscad**: Update to newest version 2026-06-08.

:::

::::

## v0.96.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- **pyide**: `show_animation()` now correctly displays animated GIFs — previously, rendering pytamaro output to a canvas element would only show the first frame. Pytamaro output (including `show_graphic()` and `show_animation()`) always renders to the output panel as an image. The `canvas` attribute is no longer needed for pytamaro.

:::

::::

## v0.96.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- **pyide**: Fix MutationObserver check (`node.type` → `node.nodeType`) so dynamically added pyide elements are correctly initialized
- **pyide**: Fix error traceback trimming — when `<exec>` is absent, the full traceback is now preserved instead of showing only the last line
- **pyide**: Remove duplicate `id="canvas"` HTML attribute on canvas elements (invalid when multiple canvas pyides exist on one page)
- **pyide**: Friendly Python error messages now use the page language instead of always loading English
- **pyide**: Pygame auto-wrap no longer injects redundant `import asyncio` / `import pygame` when already present in user code

:::

::::

## v0.96.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- **pyide**: Add `Turtle()` constructor support for creating multiple simultaneous turtles
- **pyide**: Add all standard turtle shapes: `arrow`, `turtle`, `classic`, `triangle`, `square`, `circle` (default: `classic`)
- **pyide**: Integrate friendly Python error messages via `@raspberrypifoundation/python-friendly-error-messages`

:::

:::tab{title="Improved :+1:" id="improved"}

- **pyide**: Default screen size is now 640×480
- **pyide**: Canvas wrapper now shows a checkered transparency pattern to distinguish canvas from page background
- **pyide**: Fix `js_svg_graphic` FFI for pytamaro 2.0.1 compatibility (`show_graphic`, `save_graphic_svg`)

:::

:::tab{title="Fixed :bug:" id="fixed"}

- **pyide**: Fix `write()` alignment — text no longer influences turtle position

:::

::::

## v0.95.1

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Show the Python `input()` prompt message in the browser dialog. When a script calls e.g. `input("Enter number: ")`, the prompt text is now displayed in the dialog instead of the generic "Input required:" message.

:::

::::

## v0.95.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Migrate all code editors (`webide`, `pyide`, `p5`, `typst`, `abc-music`) from Prism.js to **CodeMirror 6**, with syntax highlighting, GitHub Light/Dark themes, and proper bracket/indent handling.

:::

:::tab{title="Improved :+1:" id="improved"}

- Always show the OpenSCAD parameters panel.
- Support `/* [Tab Name] */` comment syntax to group OpenSCAD parameters into collapsible accordions. Parameters in `/* [Global] */` are shown outside any accordion, and accordion state is preserved across rebuilds.
- Parameter changes now auto-trigger a re-render of the OpenSCAD preview.
- Parameter changes are written back into the editor source code so code and form stay in sync.
- Editing OpenSCAD source code directly also triggers a re-render.

:::

::::

## v0.94.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Improve OpenSCAD rendering by running compile/render and parameter extraction inside a Web Worker so the page stays responsive.
- Improve OpenSCAD preview color handling using OFF-based parsing and grouped materials for face colors.
- Add STL/3MF download format selection for OpenSCAD.
- Add automatic 3MF export generation from indexed polyhedron data, including material and paint-color mapping.

:::

::::

## v0.93.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix text rendering in turtle library.

:::

::::

## v0.93.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Add turtle library to pyide, which mimicks the turtle library in python.
- Move pytamaro output to the canvas, which allows for better performance and more features like saving the output as an image.

:::

::::

## v0.92.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Add OpenSCAD element for rendering OpenSCAD code with interactive 3D viewer. [Learn more](/elements/openscad)

:::

::::

## v0.91.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix pyide editors not restoring saved code from the database when `code-input_load` fires before the restore handler is attached.

:::

::::

## v0.91.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- improve fullscreen mode for pyide, web ide, typst and p5
- add canvas rendering to pyide
- add graphical output to pyide

:::

::::

## v0.90.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Permaid files now use a lightweight HTML redirect instead of duplicating the full page content. This reduces build output size and build times while providing proper SEO via `<link rel="canonical">`.

:::

::::

## v0.89.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix protect directive not revealing content when wrapping tabs or other directives containing input elements.

:::

::::

## v0.89.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix issue where the base URL was not included in the SQLIDE database URL.

:::

::::

## v0.89.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Show version of the hyperbook in the console. This can be configured to "text" showing it under the Powered by Hyperbook text or "tooltip" showing it as a tooltip when hovering the Powered by Hyperbook text.

:::

:::tab{title="Fixed :bug:" id="fixed"}

- Show reuse button in h5p elements.

:::

::::

## v0.88.2

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix cloud integration not working correctly.

:::

::::

## v0.88.1

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Update to blockflows new schema

:::

::::


## v0.88.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Incremental dev rebuilds: content changes now only rebuild the affected page instead of the entire site, resulting in much faster browser updates during development.
- Force full rebuild button: a circular button in the bottom-right corner of the page triggers a full rebuild. It spins while the server is rebuilding.
- Enhanced WebSocket protocol for targeted reloads — the browser only refreshes when the currently viewed page is affected by a change.

:::

:::tab{title="Improved :+1:" id="improved"}

- The file watcher now ignores dotfiles (`.git`, `.hyperbook`) and `node_modules`, preventing unnecessary rebuild triggers.

:::

:::tab{title="Fixed :bug:" id="fixed"}

- Fixed lunr language plugin "Overwriting existing registered function" warnings during dev rebuilds.

:::

::::

## v0.87.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Add Blockflow integration for building and playing Scratch-based guided tutorials. Use `::blockflow-player` for playing and `::::blockflow-editor` for creating tutorials with steps, toolbox and UI configuration. [Learn more](/elements/blockflow).

:::

::::

## v0.86.0

::::tabs

:::tab{title="New :rocket:" id="new"}

- Add struktolab integration for creating structograms. [Learn more](/elements/struktolab). This replaces the old struktog integration.

:::

::::

## v0.85.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Add consent banner to embed and youtube elements.

:::

::::

## v0.84.5

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Updated Onlineide and Sqlide to integrated into the hyperbook store. This invalidates the state of all onlineide and sqlide instances, so your students have to start fresh.
- Move to an event driven architecture for hyperbook cloud. This is a breaking change and you have to reset your database.

:::

::::

## v0.84.3

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix tabs and collapsible processing.
- Fix protect processing.

:::

::::

## v0.84.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix hyperbook cloud integration not working correctly.

:::

::::


## v0.84.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Add hyperbook cloud support for managing students data in a central place.
- See the documentation for more information: [Hyperbook Cloud](/configuration/cloud)  

:::

::::

## v0.83.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Use bundled local versions of the Online IDE and SQL IDE instead of the
externally hosted versions on onlineide.openpatch.org. This improves
performance and reliability, enables faster updates, and prevents unexpected
changes caused by external updates.
- This increases the build size by approx. 31MB for the Online-IDE and 21MB for
the SQL IDE, but provides a much better experience for users.

:::

::::

## v0.82.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Update the Online-IDE to use onlineide2.openpatch.org, which uses the new compiler. If you have used nrw.onlineide.openpatch.org you can use the new version like this:

````md
:::onlineide{libraries=['nrw']}

```java Main.java
var l = new List<Integer>();
l.append(1);
```

:::
````

:::

::::

## v0.81.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Typst editor not loading assets correctly from the server and handling special characters.
- Typst preview not updating when the editor content changes.

:::

::::

## v0.81.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Typst can now load custom fonts. You can use the `@font` directive to load fonts from your hyperbook project. [Learn more](/elements/typst#custom-fonts) 

:::

::::

## v0.80.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Typst now loads csv, json, xml, yaml and other files.

:::

::::

## v0.79.1

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix the table of contents drawer was visible on first load and refresh for a short period of time.

:::

::::

## v0.79.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Typst now loads images and other assets from the server when using relative paths.
- Added debounce to Typst rendering to improve performance when typing quickly.

:::

::::

## v0.78.0

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Update pagelist element to match excatly by default.

:::

::::

## v0.77.9

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Update dependencies:
  - p5 to version 2.2.0
  - mermaid to version 11.12.2
  - wavesurfer.js to version 7.12.1
  - @learningmap/web-component to version 0.3.7
  - abcjs to version 6.6.0
  - jsxgraph to version 1.12.2

:::

::::

## v0.77.8

::::tabs

:::tab{title="Fixed :bug:" id="fixed"}

- Fix previous and next buttons.

:::

::::

## v0.77.7

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Dev command now detects port conflicts and prompts users to automatically find a free port when the specified port is already in use.

:::

::::

## v0.77.6

::::tabs

:::tab{title="Improved :+1:" id="improved"}

- Fix input width of multievent input

:::

::::

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
