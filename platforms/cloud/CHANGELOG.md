# @hyperbook/cloud

## 0.3.0

### Minor Changes

- [`29932e4`](https://github.com/openpatch/hyperbook/commit/29932e4fd84837c218fb935dc6e119e56d559ff9) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor's settings menu gets a font choice: the system's monospace or one of GitHub's Monaspace fonts — Neon, Argon, Xenon, Radon or Krypton. Each choice is drawn in its own font, and the choice is kept in the browser like the other editor settings.

- [`6173ca1`](https://github.com/openpatch/hyperbook/commit/6173ca1ee473fd36003106d2d818fce9e42d4e11) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor highlights more file types: Java, Python, SQL (with SQLite keywords, matching the sqlide element), Typst, plus `jsx`/`tsx`/`cjs` and `htm`/`xhtml`, and it highlights Typst code blocks inside pages. Pages ending in `.md.hbs` count as Markdown pages for spell check, and the new-file dialog mentions them. Builds and renders mark the checkout as the book's project root, so the `rfile`/`rbase64` helpers find the book's root files in the cloud too.

- [`cdfed33`](https://github.com/openpatch/hyperbook/commit/cdfed33f70686edd294ce8021a72d2675dc69223) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor's settings menu gets a line height choice, next to the font size: small, medium or large, shown as S, M and L. The choice is kept in the browser like the other editor settings.

- [`78005e2`](https://github.com/openpatch/hyperbook/commit/78005e2f6dd03b4debafa9135c54dbb04a679e06) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor gets a quick-open popup (Ctrl/Cmd+P) to search the book's files, a file tree that filters, unfolds the open file and moves files by dragging them into folders, a settings menu with font size, line numbers and spell check, and a per-book spell-check dictionary: Hunspell via Typo.js, aware of pages' code, frontmatter and directive syntax, with right-click suggestions and words to add or remove. A right-click opens the editor's own context menu — cut, copy, paste, select all, undo and redo — instead of the browser's; on a misspelled word it shows the corrections and "Add to dictionary".

- [`3be21d1`](https://github.com/openpatch/hyperbook/commit/3be21d102c86e20f1c1c4d286c257ee4f755bbbd) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Path completion offers paths relative to the page next to those from the book's root, in links, images and directives' file attributes. A click on a link in the preview opens its file in the editor.

- [`7a3eaea`](https://github.com/openpatch/hyperbook/commit/7a3eaea3473dd77ffcd2ace53de429a40199326c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The file tree gets a right-click menu in place of its "…" buttons: new file, new folder, upload, download, cut, copy, paste, rename and delete. Rename asks for the name only; moving is dragging, or cut and paste.

### Patch Changes

- [`d962440`](https://github.com/openpatch/hyperbook/commit/d9624408370a2ff7b6c61a2a3eac7f6316ee73d8) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Every part of a page is a card of its own, with a border like the books on the home page, instead of one long column of loose sections. A book's page arranges them in a grid: publishing, people and delete take the full width, the forms share rows, and the address line in the heading says whether the book is published. The delete card is tinted as the danger it is. The navigation is slimmer and the pages wider, so the cards have room to breathe.

- [`b4c9697`](https://github.com/openpatch/hyperbook/commit/b4c9697c4c86b0d5c9943e504de105804c63a79c) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The page settings get a calmer place in the editor. The frontmatter bar sits flush with the editor — no rounded corners or gap around it, just its bottom border — and the hint "Type : at the start of a line for elements" above pages is gone. The page settings and book settings popups are wider and structured into groups — General, Navigation, Appearance, Advanced and Protect the page for pages; General, Author & license, Branding, Advanced and Features for the book — in two columns, so related settings sit side by side instead of in one long list. The page settings can also remove a page's jumps: a "None" next to the previous and next page writes `prev: null` or `next: null`, so the page shows no such button.

- [`075917b`](https://github.com/openpatch/hyperbook/commit/075917b5f19d4410e4021eebc4e5440217df11b6) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor's panes are resizable: drag the borders between the file list, the editor and the preview to size them, or use the arrow keys; double-click a border to restore the default. The chosen widths are remembered per browser.

- [`a38c996`](https://github.com/openpatch/hyperbook/commit/a38c996ddaf5592e00873fe4ca52501bc4b5cbb2) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The branding section of the editor's book settings has an upload button next to the logo picker. It puts the image into the public folder and selects it as the logo, so a logo can be set without uploading the file through the file tree first.

- [`16c11d3`](https://github.com/openpatch/hyperbook/commit/16c11d31bbe33ff5155ee290719d64c08191b2a0) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The front address of an instance now shows a landing page: a short introduction to Hyperbook and the three ways to run it — hosted on hyperbook.cloud by OpenPatch (with a "Create an account" button when the admin's sign-up mode allows it), self-hosted with the one-container Docker setup, or deployed anywhere as a static site with the Hyperbook CLI — plus a login link for the admin frontend and the usual "Built with ❤️ by OpenPatch" footer. Logged-in users go straight to their books. Under Settings → General, admins can turn the landing page off (`landingPage`); then the front address shows only the login screen.

- [`7d942a6`](https://github.com/openpatch/hyperbook/commit/7d942a6bbf5ea92cb9db3c71da45a525157caf27) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor's preview pane shows the whole page — header, navigation and footer — like readers will see it. Pages in an iframe used to switch to standalone (content-only) mode automatically; a new `standalone=false` URL parameter keeps the shell, and the preview pane adds it to every page it frames.

- [`4e48036`](https://github.com/openpatch/hyperbook/commit/4e48036d1a549a4a10aa54f8e00042f7233077d7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Renaming or moving an image or other file that sits next to the pages in book/ now finds and updates the links to it, including relative ones like `./image.png`. Relative links stay relative after the rewrite, and a link's `#fragment` is no longer doubled.

- [`4648248`](https://github.com/openpatch/hyperbook/commit/46482485317d68539e6f899c2102ad8aa7802c95) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Links that an upload leaves out (symlinks in the zip) are now traceable: the full list is recorded in the build's log, the warning toast links to that log, and any build log can be downloaded as a file.

- [`4648248`](https://github.com/openpatch/hyperbook/commit/46482485317d68539e6f899c2102ad8aa7802c95) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Uploading a book as a zip shows a progress bar with the percentage sent and an "Unpacking…" state while the server processes it.

## 0.2.2

### Patch Changes

- [`32ffbb4`](https://github.com/openpatch/hyperbook/commit/32ffbb4a35886d6676ce58420c014b6b9687185d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Rename the build's "Website" link to "Download" and name the archive `<slug>.zip`.

- [`6ea0bf4`](https://github.com/openpatch/hyperbook/commit/6ea0bf474a0f014bbfff59cd65384e9243868837) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The light/dark choice applies from the first paint also where a Content-Security-Policy forbids inline scripts, so the toggle and the page no longer disagree after loading. The editor's preview follows the chosen theme, and switches with it.

## 0.2.1

### Patch Changes

- [`cd9aaee`](https://github.com/openpatch/hyperbook/commit/cd9aaee0d13a620857b69ac61da0096faa40fc01) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Hyperbook Cloud looks like a book: the sidebar fills the window height with "Power your Hyperbook" and the version at its foot, the navigation is styled like a book's, narrow screens get the sidebar as a drawer, and a toggle switches between light and dark mode.

- [`fcb8c71`](https://github.com/openpatch/hyperbook/commit/fcb8c71681c516f41b8f0fecd95129db16df4048) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The editor keeps up with typing on long pages, and its preview updates without flickering: a keystroke no longer re-renders the whole editor, the preview renders one page at a time, and the new page loads underneath the shown one and takes its place at the reader's scroll position once it is painted.

## 0.2.0

### Minor Changes

- [`e01d54f`](https://github.com/openpatch/hyperbook/commit/e01d54fdf6183b55bff24c77f61223494a56e5c7) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - `hyperbook render` renders single pages on request (JSON lines on stdin) without a full build, for editors that preview a page while it is written. Hyperbook Cloud uses it: the editor's preview shows the open page with its unsaved text as you type, and saving no longer builds the book. The editor also completes elements and their attributes, highlights them, links to their documentation, checks them, and edits a page's frontmatter as a form.

### Patch Changes

- [`6d807d8`](https://github.com/openpatch/hyperbook/commit/6d807d8346752b88993c7b51a9570de536937d4f) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - The sidebar shows which version of Hyperbook Cloud runs: its version, the build number and the commit it was built from.

## 0.1.1

### Patch Changes

- [#1172](https://github.com/openpatch/hyperbook/pull/1172) [`b389c0b`](https://github.com/openpatch/hyperbook/commit/b389c0bc3dcc8846a86a21d7c727d053061f5cbf) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Restore pull-to-refresh and the collapsing address bar on mobile

  On narrow screens the shell no longer pins itself to the viewport. It scrolled
  the article pane inside a fixed grid, which left the document scroller
  motionless — and a mobile browser drives both pull-to-refresh and the
  auto-hiding address bar off that scroller, so neither ever fired. Below 1280px
  the layout now flows normally with a sticky header, so the document scrolls and
  both gestures work again. The desktop layout, where the sidebar needs to stay
  put while the article moves, is unchanged.

## 0.1.0

### Minor Changes

- [#1164](https://github.com/openpatch/hyperbook/pull/1164) [`87e7042`](https://github.com/openpatch/hyperbook/commit/87e7042b06523cbff6cddbd8ceb60c85075dea2a) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Update all dependencies to their latest versions

  Notable upgrades: Shiki 4, Mermaid 11.16, three.js 0.185, p5 2.3, Excalidraw 0.18.1, React 19.2, Express 5, TypeScript 6, ESLint 10 and Vite 8. Rendered output is unchanged.

  hyperbook-studio now requires VS Code 1.125.0 or newer.

## 0.0.2

### Patch Changes

- [`9df0010`](https://github.com/openpatch/hyperbook/commit/9df00101a871f9298664790411ee33ad81218d45) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Make the cloud server easier to run and safer to update:

  - Published as a container image per release. `docker compose up -d` is the
    whole deployment, and `docker compose pull && docker compose up -d` the whole
    update. An image tag is something to pin, which tracking `main` never was.
    `docker-compose.yml`, a `Dockerfile` and an `ecosystem.config.js` for
    non-container deployments are committed rather than pasted from the README.
  - The schema is versioned with `PRAGMA user_version` instead of re-deriving
    itself from `CREATE TABLE IF NOT EXISTS` and column probes on every boot.
    Each migration runs at most once, in order, and the version is recorded only
    after the step succeeds, so an interrupted upgrade retries rather than skips.
  - **The database is copied aside before any migration that has work to do**,
    with `VACUUM INTO`. If the copy cannot be written, the migration does not
    run. The five most recent backups are kept.
  - Starting a build older than the one that last wrote the database is refused,
    instead of silently reading a schema it does not understand.
  - In production the server refuses to start when `JWT_SECRET` is missing or
    still the placeholder, when it is shorter than 32 characters, when `BASE_URL`
    is unset, or when SMTP is half configured. It prints every problem at once
    and suggests a generated secret. Previously a deployment that forgot
    `JWT_SECRET` ran with a value published in this repository, and said nothing.
  - `engines` now records the Node versions `better-sqlite3` can be built
    against, so a mismatch fails at install rather than at `require`.

- [`d91255b`](https://github.com/openpatch/hyperbook/commit/d91255bb77ce954056c8caa7780a1e7048e60b9d) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Fix event replay corrupting the state it reconstructs:

  - The primary key is now parsed out of the Dexie schema string. Taking the
    first field verbatim left the markers on (`++id`, `&email`, `*tags`), so the
    key matched no row property at all and every update and delete missed
    silently while creates piled up duplicates. Compound keys (`[a+b]`) and
    outbound keys are handled too.
  - A created row can no longer end up without its primary key, which made it
    unreachable to every later event.
  - Primary keys keep their type. `prim_key` stored `String(primKey)`, flattening
    numeric and compound keys so they no longer matched the rows they addressed;
    events now also carry `prim_key_json`.
  - Replay is idempotent. `create` appended unconditionally, so a retried or
    replayed batch duplicated rows; it now upserts.
  - Dexie's dotted update paths (`update(id, {"state.zoom": 2})`) are applied to
    the nested field instead of being written as a literal `"state.zoom"`
    property.
  - Events carry the client's Dexie primary-key schema, so a table with no prior
    snapshot is no longer assumed to be keyed by `id`. Tables keyed by something
    else — `bookmarks` by `path`, `onlineide` by `scriptId` — had a bogus `id`
    stamped onto every row.
  - The `afterEventId` check and the append now share one transaction. Two
    clients writing at the same moment could both pass the check and interleave.
  - A malformed batch is rejected with 400 instead of failing a CHECK constraint
    and returning 500, which the client treated as transient and retried forever.

  Both new columns are added by migration; existing databases keep working.

## 0.0.1

### Patch Changes

- [`d98c9ca`](https://github.com/openpatch/hyperbook/commit/d98c9cac95017c0bfa098929218bc94ff758a906) Thanks [@mikebarkmin](https://github.com/mikebarkmin)! - Move to an event driven architecture for hyperbook cloud
