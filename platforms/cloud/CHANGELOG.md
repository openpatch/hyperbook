# @hyperbook/cloud

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
