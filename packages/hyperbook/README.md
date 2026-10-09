# hyperbook

The main CLI tool for creating, building, and serving Hyperbook projects. Hyperbook is a quick and easy way to build interactive workbooks that support modern standards and run superfast.

## Features

- **Quick Project Setup** - Scaffold new projects with `hyperbook new`
- **Development Server** - Live-reload development server with hot module replacement
- **Production Builds** - Optimized static site generation
- **Interactive Elements** - Support for 30+ custom directives (alerts, videos, code environments, etc.)
- **Multi-language Support** - Built-in i18n for 7 languages
- **Search** - Full-text search with Lunr.js
- **Navigation** - Automatic navigation generation from file structure
- **Themes** - Customizable colors and styling
- **Archives** - Downloadable file archives for students
- **Glossary** - Automatic term indexing and tooltips

## Installation

Install globally:

```sh
npm install -g hyperbook
# or
pnpm add -g hyperbook
```

Or use directly with npx:

```sh
npx hyperbook@latest new my-book
```

## Usage

### Create a new Hyperbook project

```sh
hyperbook new my-documentation
cd my-documentation
```

### Start development server

```sh
hyperbook dev
# or with custom port
hyperbook dev --port 3000
```

The development server will start at `http://localhost:8080` with live reload.

### Build for production

```sh
hyperbook build
```

This generates a static site in the `.hyperbook/out` directory ready for deployment.

### Downloadable assets

The CLI downloads Blockflow, Online IDE, SQL IDE, Excalidraw, OpenSCAD, GeoGebra,
Pyodide, and Typst assets the first time a build or development preview uses them.
Downloads are pinned to
the CLI version, verified with SHA-256, and reused across projects. Built books
include local copies in `__hyperbook_assets`.

Prepare the current project, including its books, glossary, snippets, and templates:

```sh
hyperbook assets fetch
```

Or download every optional bundle without opening a project:

```sh
hyperbook assets fetch --all
```

Use the cache without downloading, including when new directives are added during development:

```sh
hyperbook build --offline
hyperbook dev --offline
```

If a required bundle is missing or incomplete, these commands report which asset
to prefetch. `--offline` also skips the CLI update check. Kiri:Moto remains external.
Online GeoGebra materials, arbitrary PyPI packages, Typst `@preview` imports,
YouTube and other external media still need their external services. PlantUML
diagrams use Kroki during the build. `--offline` controls asset downloads;
it does not disable those services.

The default cache is `$XDG_CACHE_HOME/hyperbook/assets` (or
`~/.cache/hyperbook/assets`) on Linux, `~/Library/Caches/hyperbook/assets` on
macOS, and `%LOCALAPPDATA%\hyperbook\assets` on Windows. Set
`HYPERBOOK_ASSET_CACHE` to use another directory. CI can restore this directory,
run `hyperbook assets fetch`, build with `--offline`, and save the cache again.

Deleting the cache is safe; the next online build downloads the required bundles again.

### Optional CDNs

Set `cdn` per element in `hyperbook.json` to load its large runtime from a CDN:

```json
{
  "name": "My Hyperbook",
  "elements": {
    "pyide": { "cdn": true },
    "typst": { "cdn": "https://assets.example.com/directive-typst/" },
    "geogebra": { "cdn": true },
    "openscad": { "cdn": false }
  }
}
```

Omitting `cdn` or setting it to `false` keeps local assets. `true` selects the
default CDN: jsDelivr for Pyodide and Typst, GeoGebra's server for GeoGebra, and
versioned Hyperbook assets on UNPKG for the other elements. The option supports
`pyide`, `typst`, `geogebra`, `openscad`, `excalidraw`, `onlineide`, `sqlide`, and
`blockflow` (both player and editor).

A custom HTTP(S) URL points to the contents of the element's
`__hyperbook_assets/directive-<element>/` directory from a local build. Keep its
subdirectories. For `pyide`, point directly to
the Pyodide distribution directory containing `pyodide.js` and
`pyodide-lock.json`.

If a custom CDN URL has a different origin from the book (domain, port, or
protocol), enable CORS on that asset server. Locally bundled assets and custom
URLs on the book's own origin need no extra CORS headers. If the book uses HTTPS,
its CDN URLs must use HTTPS too.

CDN-enabled elements skip local runtime downloads during build, development,
and `assets fetch`. Their integration scripts and styles remain local. They
can be built with `--offline` without a cached runtime, but readers need access
to the CDN. `assets fetch --all` still downloads every bundle.

### Building and releasing the CLI

Build the workspace packages before building the CLI. Its postbuild step writes
the small npm package to `dist/`, an asset manifest to `dist/asset-manifest.json`,
and eight separate archives to `.cache/asset-bundles/<cli-version>/`. The Markdown
build and VS Code extension continue to include their complete assets. Markdown's
npm tarball omits the Pyodide distribution to fit npm's upload limit; standalone
users can extract the CLI's `pyide.tar.gz` bundle alongside the other directive
assets.
Locally built CLIs use these archives directly, including with `--offline`,
so workspace builds work before the corresponding release is published.

Upstream runtime URLs and SHA-256 checksums are pinned in
`packages/markdown/runtime-assets.json` and `packages/markdown/openscad-config.json`.
Update them together when upgrading a runtime, then rebuild the bundles.

The release workflow runs `node packages/hyperbook/publish-assets.mjs` before
publishing npm packages. For an unpublished CLI version, the script verifies the
local archives, uploads them to a draft `hyperbook-assets-v<cli-version>` release,
verifies the uploaded checksums, and publishes that release. npm publication
proceeds only after the downloads are available. Already published CLI versions
are skipped. Local builds do not publish anything.

## Project Structure

A Hyperbook project consists of:

```
my-book/
├── hyperbook.json          # Main configuration
├── glossary.md             # Glossary definitions
├── book/                   # Content directory
│   ├── index.md            # Home page
│   ├── chapter1/
│   │   ├── index.md
│   │   └── page.md
│   └── chapter2/
│       └── index.md
├── public/                 # User-provided files
└── .hyperbook/out/         # Built output (after build)
```

## Configuration

The `hyperbook.json` file configures your project:

```json
{
  "name": "My Documentation",
  "description": "Interactive documentation",
  "language": "en",
  "basePath": "",
  "colors": {
    "brand": "#3b82f6"
  },
  "links": [
    {
      "label": "GitHub",
      "href": "https://github.com/org/repo"
    }
  ]
}
```

## Learn More

- **Documentation**: https://hyperbook.openpatch.org
- **Repository**: https://github.com/openpatch/hyperbook
- **Community**: https://matrix.to/#/#openpatch:matrix.org

## License

MIT © Mike Barkmin
