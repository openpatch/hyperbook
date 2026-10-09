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

### Building and releasing the CLI

Build the workspace packages before building the CLI. Its postbuild step writes
the small npm package to `dist/`, an asset manifest to `dist/asset-manifest.json`,
and eight separate archives to `.cache/asset-bundles/<cli-version>/`. The Markdown
package and VS Code extension continue to include their complete assets.
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
