# Hyperbook Cloud: PDF documents and Typst (plan)

Teachers keep worksheets, slides and exams as PDFs — more and more of them
written in Typst. Hyperbook should show such documents on a page, build
Typst sources into PDFs, and let teachers write those sources in the Cloud
editor with a live preview, without ever publishing a source or an exam by
accident.

The work spans the shared packages (`packages/markdown`, `packages/fs`,
`packages/hyperbook`, `packages/types`) and the Cloud
(`platforms/cloud`). Everything in the packages works in a local build too;
the Cloud adds the sandboxed compile, the editor preview and a publishing
lock.

## Decisions

| Topic | Decision |
|---|---|
| Element | A new leaf directive `::pdf[Label]{src="…"}`. Leaf, not container: it has no Markdown content. The label is the title and the download button's text, as in `:download`. |
| Sources | `src` may be a `.pdf` or a `.typ` file. A `.typ` source is compiled to a PDF at build time; from then on both are handled the same. |
| Rendering | pdf.js in the browser for every view, Typst or not. Rasterising at build time would need native tools (poppler, MuPDF) in every local install or AGPL code (MuPDF WASM) in an MIT project. pdf.js is pure JS (Apache 2.0) and gives a text layer (selection, search, screen readers) for free. |
| pdf.js delivery | A downloadable element runtime (`pdf`) like `typst` or `geogebra`: pinned in `runtime-assets.json`, loaded from the CDN by default, served by the Cloud's shared assets, loaded lazily per page. The **legacy build** of pdf.js, because school tablets often run old browsers. |
| Typst compiler | The official `typst` CLI, not typst.ts. It supports the current Typst version, `--root`, `--input`, `--package-path`, fonts and dependency output; typst.ts lags behind and stays the runtime of the interactive `:::typst` element. |
| Typst versions | **0.15.0 and newer.** The book pins one in `hyperbook.json` (`typst.version`). Hyperbook supports a fixed set of versions listed in `runtime-assets.json` with SHA-256 per platform. A version stays supported once it is listed, because books pin it. No reliance on a `typst` on `PATH` (overridable for development, see [Configuration](#configuration)). |
| What gets published | A `.typ` source is **never** copied into the site by default. A compiled PDF exists in the site only if a `::pdf` references it. New `exclude` globs in `hyperbook.json` keep any other file out of the site. |
| `:download` of a `.typ` | Unchanged: `:download` hands out the file it names, as it is — for a `.typ` that is the source, and naming it there is what copies it into the site. The compiled PDF comes from `::pdf` only, which has a `button` view for a plain download. One rule each: `:download` = this file, `::pdf` = this document. |
| Publishing lock | A per-book Cloud setting "Publishing disabled", **stored in the database and changeable by owners only** — not in `hyperbook.json`, which every editor can change. For books that hold exams. Publishing is owner-only already; the lock keeps an owner from publishing by accident. |
| Compile in the Cloud | Outside the Node permission sandbox of the build (it does not allow child processes), as its own step of the build job: the CLI writes a manifest of compile jobs, the runner runs `typst` on them. The binary and Typst's package cache live where the sandboxed CLI can neither read nor write. |
| Editor preview of `.typ` | Compiled on the server for the open file (unsaved text included), shown in the editor's existing PDF view; diagnostics go to CodeMirror's lint gutter. |
| Page preview of `::pdf` | The preview host compiles a `.typ` document when its PDF is requested; the page renderer only reports the jobs. |

## The element

```md
::pdf[Skript]{src="skript.pdf"}
::pdf[Arbeitsblatt Dreisatz]{src="arbeitsblatt.typ"}
::pdf[Folien]{src="praesentation.typ" view="slides"}
::pdf[Aufgaben]{src="arbeitsblatt.typ" pages="1-2"}
::pdf[Lösung]{src="arbeitsblatt.typ" inputs="loesung=true"}
```

| Attribute | Meaning | Default |
|---|---|---|
| `src` | `.pdf` or `.typ`, relative to the page or absolute from the book root (same rules as `:download`) | — |
| `view` | `pages` (all pages below each other, page width), `slides` (one page, prev/next, fullscreen, arrow keys), `thumb` (first page small, beside title and download button), `embed` (the browser's own viewer in an `<iframe>`), `button` (no viewer, only the download button — it looks like `:download` and loads no pdf.js) | `pages` |
| `pages` | Page range shown, e.g. `1-2`, `3,5-6`. The download is always the whole document, and so is what the browser loads — `pages` hides nothing (see [Security and privacy notes](#security-and-privacy-notes)). | all |
| `inputs` | `key=value` pairs, comma-separated, passed as `--input` to Typst. Only for `.typ`; on a `.pdf` the build warns. | — |
| `download` | `false` hides the download button | `true` |
| `height` | Fixed height for `slides`/`embed` (CSS length, as in other elements) | aspect of page 1 |

Why `pages` is the default and not `embed`: mobile browsers (iOS Safari,
many Android browsers) show only the first page of an embedded PDF or start a
download. Students mostly work on tablets.

Rendering rules for the client (`assets/directive-pdf/client.js`):

- Load pdf.js only when a `::pdf` element scrolls near the viewport.
- Render pages lazily (IntersectionObserver), at device pixel ratio, and
  re-render on width changes; `thumb` renders page 1 only.
- Add pdf.js's text layer, so text can be selected and read aloud.
- Without JavaScript the element is a plain link to the PDF (the hast
  output contains an `<a href>`; the client replaces it).
- Dark mode does not invert pages — a worksheet stays a white sheet.

The `pdf` runtime is more than one file: pdf.js's legacy build, its worker,
the cmaps, the standard fonts and the wasm image decoders, all taken from the
`pdfjs-dist` npm tarball pinned in `runtime-assets.json`. The worker is loaded
from the same place as the library (same origin as the page on the Cloud).

Download only, PDF or source:

```md
::pdf[Arbeitsblatt (PDF)]{src="arbeitsblatt.typ" view="button"}
:download[Typst-Vorlage]{src="vorlage.typ"}
```

- `view="button"` offers the compiled PDF without showing it. `download`
  and `pages` have no meaning there; the build warns if they are set.
- `:download` does not change. It offers the file it names, so for a `.typ`
  the source — and that reference is the one thing that copies a `.typ`
  file into the site. It never compiles anything.
- A `:download` of a file matched by the book's own `exclude` globs is a
  build warning and the file stays out: an explicit `exclude` wins. Only the
  implicit `**/*.typ` rule is lifted by a `:download`.

A Markdown link or image that points at a file which is not copied (a `.typ`
source, anything matched by `exclude`) is a build warning that names the
page, the file and the way out (`:download` for the source, `::pdf` for the
document, or the `exclude` entry). Such links would otherwise break without
a word.

## Typst at build time

### Configuration

```json
{
  "typst": {
    "version": "0.15.0",
    "packagePath": "typst-packages",
    "fontPath": "fonts"
  },
  "exclude": ["**/*.draft.*", "intern/**"]
}
```

- `version`: one of the versions this Hyperbook release supports (0.15.0 and
  newer); the build fails with the list of supported versions otherwise.
  Missing → the newest supported one, with a warning that it should be
  pinned.
- `packagePath`: a folder in the book, passed as `--package-path`. It holds
  `@local` packages (layout `<namespace>/<name>/<version>/`), so a book can
  carry its own templates — and `preview/<name>/<version>/` for a book that
  must build without network. `@preview` packages from Typst Universe that
  are not in the book are downloaded by Typst into a package cache
  (`--package-cache-path`): locally a folder of its own in Hyperbook's asset
  cache, in the Cloud a folder the sandboxed build cannot touch (see
  [Where Typst lives](#where-typst-lives)).
- `fontPath`: a folder in the book, passed as `--font-path`. The build runs
  with `--ignore-system-fonts`, so a book compiles the same on every machine.
- `exclude`: globs matched against a file's address in the site, without
  the leading slash (`intern/**` covers `public/intern/…` and
  `book/intern/…` alike), applied to `public/` and the non-page files under
  `book/` and `glossary/`. Supported: `*`, `**`, `?`, `{a,b}`. `**/*.typ` is excluded
  implicitly; a source reaches the site only through a `:download` that
  names it or as part of a package a `:::typst` block imports.
- Development override: `HYPERBOOK_TYPST_BINARY=/usr/bin/typst` uses a local
  binary (any version, with a warning).

### Compile jobs

While pages are processed, every `::pdf` with a `.typ` source registers a compile job on the file (like `archiveIncludes` today):
`{ src, inputs, out }`. After the pages, the build runs the jobs — the same
place where `runArchive` zips archives.

- **Output name:** `<name>.pdf` next to the source's URL without inputs;
  with inputs `<name>.<hash8>.pdf`, the hash over the sorted inputs. One job
  per distinct `(src, inputs)`, however many pages reference it. If a file
  of that name exists in the book already (`arbeitsblatt.pdf` next to
  `arbeitsblatt.typ`), the build fails and names both files.
- **Creation date:** `--creation-timestamp` is set — to the commit time in
  the Cloud, to `SOURCE_DATE_EPOCH` locally when it is set. Without it two
  compiles of the same document differ in their bytes; with it they are
  identical. A PDF taken from the cache keeps the date of the build that
  compiled it, so an unchanged document keeps its bytes (and its ETag) from
  publish to publish.
- **Root:** `--root` is the book root, so `#import "/templates/…"` and
  images resolve the same locally and in the Cloud, and nothing outside the
  book can be read.
- **Cache:** an unchanged document is not compiled again. Locally the
  cache is `.hyperbook/typst-cache/`; the Cloud keeps one per book (see
  [Compile cache](#compile-cache)). Both follow the same rules:
  - Every compile runs with `--deps <file> --deps-format json`. Typst
    writes `{"inputs": [...], "outputs": [...]}`; `inputs` lists every file
    it read — the source, imports, images, data files, the files of
    packages — as paths relative to the working directory.
  - An entry is stored per job (`src` + sorted inputs) and holds the PDF,
    its SHA-256, and what it was made from: the Typst version, the
    `--input` values, the `packagePath`/`fontPath` settings, the content
    hash of every file in `inputs`, and a hash over the font folder.
  - **Fonts are not in Typst's dependency list** (measured: a document
    using a font from `--font-path` lists only its source and images). So
    the font folder — names and content hashes of its files — is part of
    every entry; changing a font recompiles every document.
  - A job is a hit when all of that is equal for the current files. A
    dependency that is gone, or outside the book, the shared package
    folder and the package cache, is a miss. (Typst writes dependencies
    outside the working directory as absolute paths; the entry stores them
    relative to the folder they belong to.)
  - Typst writes the dependency file for a failing compile too. Failures
    are not cached, but the dev server uses that list to know which files
    to watch for a broken document.
- **Errors:** a failing compile is a build error with Typst's diagnostics
  (file, line, message), formatted like other build errors. The dev server
  shows them in its error overlay.
- **Dev server** (`incremental.ts`): a change to a `.typ` file recompiles
  the jobs whose dependency set contains it, then reloads the pages that
  reference them.
- **Precedent:** `.h5p` files are already transformed at build time
  (`extractH5p`); Typst follows the same idea.

### Binary resolution (`packages/hyperbook/helpers/typst-binary.ts`)

Supported versions are listed in `packages/hyperbook/typst-versions.json`
(shipped beside the built CLI, where the Cloud reads it too), with the
upstream release URL, the archive's SHA-256 and the binary's own SHA-256 per
platform (`x86_64-unknown-linux-musl`, `aarch64-…`, `x86_64-apple-darwin`,
`aarch64-apple-darwin`, `x86_64-pc-windows-msvc`). The binary is downloaded
on first use into the existing asset cache, both hashes are checked, and it
is reused (checked again by each new process). Adding a Typst version is a
Hyperbook release.

Typst publishes its Linux and macOS builds as `.tar.xz`. Node has no xz, so
the archive is unpacked with the system's `tar` (GNU tar with xz-utils, or
macOS's tar); Windows releases are zips, which the CLI unpacks itself. This
replaced the earlier idea of mirroring repacked `.tar.gz` archives on
`cdn.openpatch.org`: the upstream archive is used as published, and a
missing xz gives a message that names `HYPERBOOK_TYPST_BINARY`.

This download happens only in a local build. In the Cloud the CLI never
fetches or starts Typst; see below.

## Shared packages

Some packages belong to every book of an instance — on Hyperbook Cloud
`assessio`, `mathora` and `computo`. A book imports them without carrying
them:

```typ
#import "@local/assessio:0.1.0": *
```

### A second package folder

Typst takes one `--package-path`. Hyperbook therefore knows two package
folders and hands Typst one merged view of them:

1. the **shared folder**, given by `HYPERBOOK_TYPST_PACKAGE_PATH` (same
   layout, `<namespace>/<name>/<version>/`), read-only;
2. the **book's** `packagePath`, which wins where both hold the same
   namespace, name and version — a book can still carry a package, or a
   patched copy, of its own.

The merged view is a folder of links, one per package version, made for the
build (in `.hyperbook/` locally, in the job dir in the Cloud; copies where
links are not available). It is what `--package-path` gets. Packages in
neither folder are looked up on Typst Universe as before.

- The shared folder is part of every compile's cache entry through its
  files: Typst lists the package files it read in its dependency output,
  whatever folder they come from, and the cache hashes their content.
- The same variable serves a local build: a teacher who clones the three
  packages into one folder and points the variable at it builds the book
  as the Cloud does. Without it, a book that imports a shared package fails
  locally with Typst's "package not found" — and Hyperbook adds a hint
  naming the variable.
- `:::typst` blocks get shared packages the same way as the book's own
  (see [Packages from the book](#packages-from-the-book)): the build packs
  the ones a block imports into the site.

### The Cloud's library

- The shared folder of an instance is `DATA_DIR/typst/library/`. The
  runner builds the merged view from it; the sandboxed CLI gets it as
  `HYPERBOOK_TYPST_PACKAGE_PATH` with **read** permission only
  (`--allow-fs-read`), which it needs to follow imports and pack archives
  for `:::typst` blocks.
- **Admin page** (instance settings, admins only): the list of packages
  and versions, and an upload of a package archive (`.zip` or `.tar.gz`).
  The upload is checked like a zip upload of a book — size limit, no
  links, no paths that leave the archive — and must hold a `typst.toml`
  whose name and version decide where it goes; the namespace is chosen in
  the form, `local` by default. Every change is in the audit log. All text
  in the i18n catalogs.
- **A version cannot be replaced**, only added or removed. Books name the
  version they import, so a book keeps building the same way until its
  author moves to a newer one. Removing a version asks for confirmation:
  books that import it stop building.
- **Namespace:** `@local` is what Typst itself uses for packages on the
  author's machine, so the same import works in a plain `typst compile`
  there. An own namespace (`@openpatch/assessio`) works too — tried — and
  makes clear in a document where a package comes from; it is the admin's
  choice per package.
- **Editor:** the `.typ` editor completes `#import "@…"` with the packages
  of the library and of the book, with their versions.
- **Everyone can read these packages.** Every teacher of the instance can
  import them, and a package a `:::typst` block imports is published with
  that book. The library is for teaching libraries, not for anything
  private; the admin page says so.

## The `:::typst` element

The interactive element compiles in the browser with typst.ts. Today that
is typst.ts 0.7.0, whose compiler is Typst 0.14.2, and the element sees
only the files given to it in the page. Two changes bring it in line with
`::pdf`.

### Typst 0.15

typst.ts 0.8.0 carries Typst 0.15.1 (checked in the compiler of
0.8.0-rc4, published 2026-11-09; 0.8.0 itself is not out yet). The update
is a change of pins in `runtime-assets.json`: the bundle, the compiler and
renderer wasm, and the `typst-assets` fonts (v0.13.1 today) to the release
that matches.

- Decided 2026-11-11: released with 0.8.0-rc4 rather than waiting for
  0.8.0; move to 0.8.0 when it is out.
- The element has one Typst version per Hyperbook release; a wasm compiler
  per supported version would be ~30 MB each. A book that pins a newer
  `typst.version` for `::pdf` than the element carries gets a build warning
  on pages that use both.

### Packages from the book

A `:::typst` block can import the packages in the book's `packagePath`
(`@local/…`, and `@preview/…` packages the book carries) and the
[shared packages](#shared-packages), like a `::pdf` document.

- **Build:** the sources of a block are scanned for
  `@<namespace>/<name>:<version>` imports. For each one found in the book's
  or the shared package folder — and, following the imports inside those
  packages, the
  ones they need — the build writes
  `<namespace>/<name>-<version>.tar.gz` into the site's Typst package
  folder, once per package, however many blocks use it. A `packages="…"`
  attribute adds packages that no source imports yet, for blocks in edit
  mode where students write the import themselves.
- **Client:** typst.ts's browser bundle exports `FetchPackageRegistry`,
  `MemoryAccessModel`, `withPackageRegistry` and `withAccessModel`. The
  registry's `resolvePath(spec)` returns the address of a package archive;
  as shipped it always answers with
  `https://packages.typst.org/preview/<name>-<version>.tar.gz`, whatever
  the namespace. The element registers a subclass that answers with the
  book's own archive when the build listed that package for the page, and
  with Typst Universe otherwise.
- **Cloud:** the page renderer writes the archives too (it is Node code,
  no child process), so the page preview has them.
- **These packages are public.** The browser compiles, so it must load the
  package's sources: a package used by a `:::typst` block is in the site,
  for everyone who can read the book. This is the second way a `.typ`
  source reaches the site, next to `:download`, and like there it happens
  only for what a page names. The build lists the packages it publishes; a
  package matched by the book's `exclude` globs is not published and the
  block fails to build with a message that says why. Keep templates with
  solutions or exam material out of packages that interactive blocks use.
- **Fonts** from `fontPath` are not loaded by the element: every reader
  would download the whole folder. A block names its fonts with
  `::file{font}` as today.

Not tried yet: the registry subclass in a running browser. The exports and
the shape of `resolvePath` are read from the 0.8.0-rc4 bundle; a spike
before step 10 should load one `@local` package this way.

## The Cloud

### Compile in the build job

The build runs the CLI under Node's permission model (`hosting/runner.ts`,
`cliPermissions`), which forbids child processes. Allowing them would let
the CLI start anything with the server user's rights. Instead:

1. The CLI runs with `HYPERBOOK_TYPST=manifest`: it registers compile jobs
   as usual but writes them to `.hyperbook/typst-jobs.json` instead of
   running Typst, and leaves the references in the HTML pointing at the
   final PDF names. In this mode it neither downloads nor starts a binary.
2. The runner reads the manifest and treats it as untrusted: every path
   must be inside the job dir, without `..`, a plain file (checked with
   `lstat`, no links), the output only inside the build output, the version
   one of the supported ones, the number of jobs at most `TYPST_MAX_JOBS`
   (default 200). Anything else fails the build.
3. It runs the pinned `typst` binary for each job, one after the other,
   with:
   - `cwd` and `--root` = the book checkout in the job dir,
   - an empty environment (as the CLI gets), `--ignore-system-fonts`,
     `--creation-timestamp` = the commit time,
   - `--package-path` = the merged view of the instance's library and the
     book's `packagePath` (see [Shared packages](#shared-packages)), made
     by the runner in the job dir, outside the checkout;
     `--package-cache-path` = the instance's Typst package cache,
   - the limits listed below.
4. A failed job fails the build; its diagnostics go into the build log.

**Limits** — Typst cannot run arbitrary code and reads only below `--root`
and its package paths, so it does not need Node's sandbox. It does need
limits against long or huge compiles:

| Limit | How | Default |
|---|---|---|
| Time per job | Wall clock, then `SIGKILL` | `TYPST_TIMEOUT_SECONDS` = 60 |
| Time for all jobs | They run inside the build's own deadline (`BUILD_TIMEOUT_SECONDS`): a job gets the smaller of its own timeout and what is left of the build's. The build's abort signal (cancel) kills the running job. | — |
| Memory | `ulimit -v` set by a fixed `/bin/sh` wrapper that then `exec`s Typst; the job's arguments are passed as positional parameters, never pasted into the script. Typst aborts (`SIGABRT`, "memory allocation … failed") when it hits the limit; the runner reports that as "needs more memory than allowed". | `TYPST_MEMORY_MB` = 2048 |
| Output size | `ulimit -f` in the same wrapper, set to what is left of the book's size limit, so a runaway PDF cannot fill the disk. Typst is killed (`SIGXFSZ`) and leaves a cut-off file behind. The finished PDF counts toward the build's size like any other file. | `BOOK_MAX_MB` |
| Core dumps | `ulimit -c 0` in the same wrapper: both limits above end Typst with a signal that would otherwise write a core file | — |
| CPU | `--jobs 2`, so one build does not take every core | — |
| Jobs per build | Checked when the manifest is read | `TYPST_MAX_JOBS` = 200 |

Typst writes straight into its output file, and a killed compile leaves a
cut-off PDF. So the runner lets Typst write to a temporary name in the job
dir and moves the file to its place only after exit code 0; anything else
is deleted.

### Compile cache

The job dir is made for one build and removed after it, so the CLI's
`.hyperbook/typst-cache/` would always be empty in the Cloud. The runner
keeps a cache per book instead, in `DATA_DIR/typst/cache/<bookId>/`, with
the rules of [Compile jobs](#compile-jobs):

- Before a job, the runner looks up its entry and compares the Typst
  version, the inputs, the settings, the font folder and the content hash
  of every recorded dependency with the files of this checkout. On a hit it
  copies the PDF into the build output (after checking the PDF's own
  SHA-256) and notes "unchanged" in the build log. On a miss it compiles
  and writes the entry.
- Entries are written to a temporary name and renamed, so a build that is
  killed half-way leaves no broken entry. Builds of one book already run
  one after the other.
- After a successful build the cache is cut down to the entries that build
  used. It is therefore never larger than the PDFs of one build, and a
  document that is no longer referenced leaves it. The folder is deleted
  with the book.
- Only the runner writes it. It is outside the sandboxed CLI's permissions
  like the rest of `DATA_DIR/typst/`, and it is per book, so one book
  cannot feed another a PDF.
- The preview compiles (page preview and the editor's `.typ` preview)
  read this cache — a document whose text equals the last save is a hit —
  but do not write it; unsaved text would add an entry per keystroke. They
  keep only the newest result per document, in the preview's own job dir.
- The cache is not in backups (like builds). After a restore the first
  build compiles everything again.

The Cloud's cache is the runner's own code (`hosting/typst.ts`), because
the Cloud starts the CLI as a process and does not import it. Both
implementations are tested against the same fixture book.

### Where Typst lives

The sandboxed CLI may write the shared asset cache (`cliPermissions`), and
the runner starts Typst with the server's rights. A binary in that cache
could be replaced by a build that got out of Hyperbook's own logic — the
reason the image keeps the CLI owned by root. So Typst gets a place of its
own, `DATA_DIR/typst/`, which is in none of the CLI's permission flags:

- `DATA_DIR/typst/bin/<version>/typst` — the binaries. Fetched **by the
  server**, not by a build: when a build or a preview first needs a
  version, the runner downloads the archive named in the CLI's
  `runtime-assets.json` (read the way `cliRuntimeManifest` reads the
  runtimes), checks its SHA-256, unpacks it and records the binary's own
  hash. One download per version, serialized. The recorded hash is checked
  again the first time a server process uses the binary.
- `DATA_DIR/typst/packages/` — Typst's `@preview` package cache
  (`--package-cache-path`). Only Typst writes it.
- `DATA_DIR/typst/cache/<bookId>/` — the compile cache (see
  [Compile cache](#compile-cache)). Only the runner writes it.
- `DATA_DIR/typst/library/` — the instance's shared packages (see
  [Shared packages](#shared-packages)). Only the admin page writes it. It
  is the one part of `DATA_DIR/typst/` the sandboxed CLI may **read**; it
  may write none of it. Unlike the rest it belongs in backups: it is
  uploaded, not downloaded.
- If the download fails (no network, wrong hash), the build fails with a
  message that says so and names the folder. An operator of an instance
  without egress puts the binary there by hand; the same hash check
  applies.

The binaries are on the data volume, not in the image, so a new supported
version needs no new image. The Docker image does not change.

**Network.** The Hyperbook build itself still needs none (`--offline`). The
Typst step does, in two cases: the first use of a Typst version, and a
document that imports an `@preview` package the instance has not cached. On
an instance with egress shut, such a document fails with Typst's own
download error; the book can carry the package in its `packagePath`
(`preview/<name>/<version>/`) instead. Update the comment at the top of
`hosting/runner.ts`, which today says the build needs no network at all.

### Page preview

The preview host renders pages one by one with `hyperbook render`, in the
same sandbox as the build, and serves all other files straight from the
book checkout. A page with `::pdf[…]{src="blatt.typ"}` would point at a
`blatt.pdf` that nothing has made. So:

- `hyperbook render` reports a page's compile jobs in its reply (next to
  `archiveIncludes`), always in manifest mode.
- `Renderers` keeps, per book, the map from PDF address to job
  (`{ src, inputs }`), filled as pages are rendered. This is also what
  turns `blatt.<hash8>.pdf` back into its inputs.
- When the preview host is asked for an address in that map, it compiles
  the document — with the editor's unsaved text in the checkout, like the
  pages — and answers with the PDF. The result is kept until the checkout
  changes. A failing compile answers with Typst's diagnostics as text, which
  the `::pdf` client shows in place of the document.
- These compiles use the same runner step, limits and queue as the
  editor's `.typ` preview.

### Editor: `.typ` preview

`.typ` files already open as text with `codemirror-lang-typst`. New:

- A preview pane for the open `.typ` file, next to the editor, like the
  page preview. On save — and debounced while typing — the server compiles
  the file with the unsaved text written into the preview checkout (the
  same mechanism `hosting/renders.ts` uses for pages) and returns the PDF or
  the diagnostics.
- The PDF appears in the editor's existing PDF view (`files.ts`, kind
  `pdf`). Diagnostics go to CodeMirror's lint gutter (`@codemirror/lint`
  is already a dependency) with line and message.
- Preview compiles share the build's limits and binary. At most one running
  compile per open file, newer requests cancel older ones; and at most
  `TYPST_PREVIEW_CONCURRENCY` (default 2) on the whole instance, the rest
  wait in a queue — the same idea as `MAX_RENDERERS` for pages.
- Every `.typ` file can be previewed, referenced or not — preview is for
  members only and never published.

Editor integration of `::pdf` itself:

- Snippets in `editor/directives.ts` (`::pdf[…]{src=""}` and the `view`
  variants), autocomplete of `src` from the file tree for `.pdf`/`.typ`.
- `shared/references.ts`: `::pdf` `src` counts as a reference, so renaming
  or moving a file updates it and "references" lists it.
- AI assistant: `src/server/ai/docs/pdf.md`, the entry in `docs.ts` and the
  element list in `ai/prompt.ts`.

### Publishing lock

Publishing is owner-only already (`bookAccess(…, "owner")` in
`admin/routes/publishing.ts`); editors can only ask for it. The lock is
therefore not about who may publish. It keeps an owner — or a co-owner, or
an admin acting for them — from putting an exam book online with one
click.

- New column `books.publishing_disabled` (boolean, default false), Drizzle
  migration. For hosted books only; a book with an external address has
  nothing published here, and the switch is not shown for it.
- Only owners (and admins) can change it; the change is written to the
  audit log.
- While set: `POST /books/:id/publish`, publish requests and rollbacks are
  refused (403 with a catalog message); zip upload builds do not publish.
- **Enforced where a build becomes the published one**, not only in the
  routes: `finish()` in `hosting/builds.ts` reads the lock inside its
  transaction and leaves `publishedBuildId` alone when it is set, for
  publish, rollback and upgrade builds alike, with a note in the build log.
  Otherwise a publish build queued a moment before the lock was turned on
  would still go live. The instant publish and rollback paths that reuse a
  kept build check it inside `withBookLock`.
- Turning the lock on unpublishes an already published build — after a
  confirmation in the UI — clears a pending publish request and marks
  queued publish builds as not publishing. Since nothing is published
  while the lock is set, `visibility` needs no rule of its own.
- Previews, builds, downloads of the source and of the built site stay
  available to members.
- UI: a switch in the book settings with an explanation ("for exams and
  other material that must never be public"), a badge on the book card.
  All text in `src/shared/i18n/locales/{en,de}.ts`.

## Security and privacy notes

- **`:::protect` does not protect files.** A `::pdf` inside a protected
  block hides the viewer, but the PDF itself is a plain file in the site.
  Document this on the `pdf` and `protect` pages; for real secrecy use a
  private book or the publishing lock.
- **Every referenced variant is public with the book.** A solution built
  with `inputs="loesung=true"` is in the site from the first build, even if
  the page shows it only inside a protected block. Its name
  (`arbeitsblatt.<hash8>.pdf`) is derived from the inputs and therefore
  guessable — it is not a secret. Time-based release of solutions is out of
  scope (see below).
- **`pages` and `download="false"` hide nothing.** The browser loads the
  whole PDF to show two pages of it, and its address is in the page. A
  worksheet with the solution on page 3 gives the solution to anyone who
  opens the file. Solutions belong in a separate document (or a separate
  `inputs` variant) that is referenced only where it may be seen. Say this
  on the `pdf` documentation page, next to the `pages` attribute.
- **Sources stay private by default:** `**/*.typ` is never copied unless a
  page names it in a `:download`, or a `:::typst` block imports the package
  it belongs to (see [Packages from the book](#packages-from-the-book));
  this is the guarantee that matters for exams.
- **Typst never runs from a place a build can write.** Binaries and the
  package cache are in `DATA_DIR/typst/`, outside the sandboxed CLI's
  permissions, and the binary's hash is checked (see
  [Where Typst lives](#where-typst-lives)). The compile manifest the CLI
  writes is validated as untrusted input.
- **The package cache is shared by all books** of an instance. Only Typst
  writes it, and only with packages it downloaded from Typst Universe
  itself, so one book cannot plant a package for another.
- **Private books:** PDFs are served from the book host with the student
  session cookie, like every other file; pdf.js fetches same-origin, so
  nothing changes there.

## Compatibility

- `::pdf`, `exclude` and the `typst` config are additions.
- `:download` does not change, also not for `.typ` files.
- Not copying `.typ` files any more is a behaviour change only for books
  that reach a source with a plain Markdown link: that link breaks (with the
  build warning described under [The element](#the-element)). Release it as
  a minor version with a changeset that names the change and the fix (use
  `:download`). `:::typst` is not
  affected: it inlines its `.typ` files at build time (`ideWorkspace.ts`).
- **`:::typst` moves from Typst 0.14.2 to 0.15** with the typst.ts update
  (see [The `:::typst` element](#the-typst-element)). Documents in existing
  books that use something 0.15 removed need a change; name it in the
  changeset. The element still has one Typst version per Hyperbook release:
  `typst.version` in `hyperbook.json` applies to `::pdf` only.

## Tests

- **Shared packages:** a book compiles with a package that is only in the
  shared folder; the book's copy wins over the shared one; a package
  importing another shared package works; changing a shared package's file
  recompiles the documents that use it; the sandboxed CLI can read the
  library and cannot write it; the admin upload refuses links, paths that
  leave the archive, a missing `typst.toml` and an existing version; only
  admins reach the page.
- **`:::typst` packages:** imports are found in a block's sources and
  inside packages, each package is written once, a package matched by
  `exclude` fails the block, the `packages` attribute adds one, a page
  without such imports publishes no package; in the browser (e2e) a block
  importing an `@local` package renders.
- **markdown:** directive output for every `view`, `pages` parsing, the
  no-JS fallback link, warnings (`inputs` on `.pdf`, missing `src`), job
  registration and de-duplication, output names with inputs, the warning
  for a link to a file that is not copied.
- **hyperbook build:** a fixture book with a `.pdf`, a `.typ` with an
  import and an image, and an unreferenced `.typ`. Asserts: PDFs exist for
  referenced sources, **no `.typ` file and no PDF of an unreferenced source
  is in the output**, `exclude` works, the cache skips unchanged documents,
  a Typst error fails the build with file and line, a `.typ` next to a
  `.pdf` of the same name fails the build, two builds of the same commit
  give the same bytes, manifest mode starts no process.
- **fs:** `exclude` on `public/`, `book/` and `glossary/` files.
- **Cloud unit:**
  - manifest validation: paths outside the job dir, links, an unsupported
    version, too many jobs;
  - limits: the job timeout kills the process, the build's deadline and
    its abort signal do too, a killed compile leaves no PDF in the output,
    the preview queue never runs more than `TYPST_PREVIEW_CONCURRENCY`
    compiles;
  - cache: a second build of an unchanged document starts no process and
    gives the same bytes; a change to the source, an imported file, an
    image, an `--input`, a font or the Typst version recompiles; an entry
    whose PDF does not match its hash is dropped; the cache holds only the
    last build's entries; a preview compile writes nothing into it;
  - binary: a wrong hash is refused, `DATA_DIR/typst` is in none of
    `cliPermissions`' flags;
  - page preview: a rendered page's jobs reach the map, a request for the
    PDF compiles it, unsaved text is used;
  - publishing lock: every route that publishes, **a publish build that
    finishes after the lock was set does not go live**, an upgrade build
    neither, owner-only toggle, audit entry, i18n keys in both catalogs.
- **Cloud e2e:** create book → add `.typ` → preview shows the PDF → add
  `::pdf` to a page → **the page preview shows the document** → build →
  the page shows the document → lock publishing → publish is refused.
- A real Typst binary in CI (the pinned Linux build from
  `typst-versions.json`, or `TYPST_BINARY`/`HYPERBOOK_TYPST_BINARY`): the
  compile tests use the `typst` on `PATH` and are skipped without one, so CI
  must install it for them to run.

## Work order (each step one PR-sized change)

Status (2026-11-11): all twelve steps are implemented and tested. Step 10
pins typst.ts **0.8.0-rc4** (Typst 0.15.1) instead of waiting for 0.8.0, by
decision; rc4 still loads its default fonts from typst-assets v0.13.1, so the
fonts pin stays. Step 11 works in a browser: `@local` packages from the book
and the shared folder, a package importing another, and `@preview` from
Universe side by side. typst.ts's own registry refuses every namespace but
`preview`, so the client registers a subclass through `$typst.use(…)` (as
`beforeBuild` it would collide with the default registry `$typst` adds).
Archives are written next to each rendered page, so builds, the dev server
and the Cloud's page preview all have them.

1. **`exclude` globs** in `hyperbook.json` (types, `fs`, build, dev server,
   JSON schema, docs). No behaviour change without the setting.
2. **`::pdf` for `.pdf` files:** directive, pdf.js runtime as downloadable
   element `pdf` (`elementCoreFiles`, `elementRuntimeFiles`,
   `runtime-assets.json`, `elementAssetUrl`), client for `pages`, `thumb`,
   `embed`; docs in `website/en` and `website/de`. Useful to every book on
   its own.
3. **`slides` view** and the `pages`/`height`/`download` attributes.
4. **Publishing lock:** migration, routes, the check in `finish()`, UI,
   audit, i18n. It depends on nothing else and is the safeguard for exam
   books, so it is in place before Typst reaches the Cloud.
5. **Typst binary resolution** in `helpers/typst-binary.ts`, `typst`
   config, supported versions (0.15.0 and newer) in `typst-versions.json`.
6. **Compile jobs in the CLI:** `.typ` in `::pdf`, the `button` view,
   implicit `**/*.typ` exclusion, the link warning, cache, error reporting,
   dev server recompiles — **and manifest mode**. In the same change the
   Cloud's runner and renderer set `HYPERBOOK_TYPST=manifest` and fail a
   build whose manifest has jobs with a clear message ("Typst documents are
   not built on this instance yet"). The Cloud image builds the CLI from
   this repository, so without this a deploy between steps 6 and 7 would
   have the sandboxed CLI trying to start a process. Changeset with the
   compatibility note.
7. **Cloud build:** `DATA_DIR/typst`, the server-side download and hash
   check, the runner's Typst step with its limits, the per-book compile
   cache, build log output.
8. **Cloud preview:** compile on request in the preview host, the `.typ`
   preview pane, diagnostics, the instance-wide queue.
9. **Cloud editor:** `::pdf` snippets, references, AI docs.
10. **`:::typst` on Typst 0.15:** the typst.ts 0.8.0 pins and fonts, the
    changeset for existing books. Waits for the 0.8.0 release; independent
    of every other step.
11. **Packages in `:::typst`:** the spike, package archives in the build
    and the page renderer, the registry in the client, the `packages`
    attribute, docs. Needs step 5 (`packagePath`) and step 10.
12. **Shared packages:** `HYPERBOOK_TYPST_PACKAGE_PATH` and the merged view
    in the CLI; in the Cloud the library folder, the runner's merged view,
    the CLI's read permission, the admin page, import completion in the
    editor. Needs step 7; `:::typst` blocks get shared packages once step
    11 is in.

Steps 1–3 need no Typst at all; step 4 is the Cloud's safeguard; steps 5–6
make Typst work locally; 7–9 bring it to the Cloud; 10–11 bring the
interactive element along; 12 gives every book the instance's packages.

## Out of scope for now

- Time-based release of documents (e.g. solutions after a date).
- `::filelist` — an automatic list of the PDFs in a folder.
- Pulling documents from another book (`project:` references).
- Filling the Cloud's package library from a git repository or from Typst
  Universe instead of by upload.
- Comments on documents and editing at the same time.
- Rendering `.typ` previews in the browser with typst.ts.
- Rasterised page images as a fallback for very old devices.
- Typst versions older than 0.15.0.

## Open questions

- Does the publishing lock also hide the book from colleagues' "View as
  student"-style links, or only from publishing? (Proposed: only
  publishing.)
- What does Typst do for an `@preview` package that is neither in the book
  nor cached when the instance has no network — how long does it wait, and
  is its message clear enough for the build log? (Not tried: it needs a
  machine without egress.)

## Checked against Typst 0.15.1

Tried by hand on Linux with the `typst` 0.15.1 binary, on a small book with
an absolute import, a data file, an image and packages:

- Every flag the plan uses exists: `--root`, `--input`, `--font-path`,
  `--ignore-system-fonts`, `--package-path`, `--package-cache-path`,
  `--creation-timestamp`, `--deps`, `--deps-format`, `--jobs`,
  `--diagnostic-format`.
- `--deps-format json` gives `{"inputs": [...], "outputs": [...]}`. The
  inputs are relative to the working directory and include the files of
  packages. Fonts from `--font-path` are **not** listed. The file is
  written for a failing compile too (`"outputs": null`).
- A package in `<packagePath>/preview/<name>/<version>/` is used for
  `@preview/<name>:<version>` without any download; the package cache
  stayed empty. `@local` packages work the same way.
- A `--package-path` folder made of links — one per package version, some
  into a shared folder, some into the book — works: a shared package that
  imports another shared package compiles, the book's copy of a package
  wins over the shared one, and a namespace of one's own (`@openpatch/…`)
  is accepted. Dependencies outside the working directory are listed as
  absolute paths.
- With `--creation-timestamp` two compiles are byte-identical; without it
  they differ.
- `--diagnostic-format short` prints `bad.typ:3:1: error: unknown variable:
  nope`, exit code 1, and no PDF.
- A path that leaves the root is refused ("would escape the project
  root").
- `ulimit -v` (1 GB) stops a document that allocates more: "memory
  allocation of … bytes failed", `SIGABRT`, after 2 s. A normal document
  compiles under a 256 MB limit.
- `ulimit -f` stops a document whose PDF outgrows the limit with `SIGXFSZ`
  and leaves a file cut at the limit.
- Both signals would write a core file; hence `ulimit -c 0`.
- Typst reads the main file from standard input when the source is `-`.
  Not used by the plan (the preview writes unsaved text into its checkout,
  so relative imports keep working), but an option.

Not checked: the macOS and Windows binaries, where the `ulimit` wrapper does
not apply — it is a Cloud (Linux) matter; local builds have no limits.
