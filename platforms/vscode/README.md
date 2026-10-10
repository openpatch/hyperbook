# Hyperbook Support for Visual Studio Code

[![version](https://img.shields.io/vscode-marketplace/v/openpatch.hyperbook-studio.svg?label=version)](https://marketplace.visualstudio.com/items?itemName=openpatch.hyperbook-studio)
[![installs](https://img.shields.io/vscode-marketplace/d/openpatch.hyperbook-studio.svg?label=installs)](https://marketplace.visualstudio.com/items?itemName=openpatch.hyperbook-studio)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/openpatch/hyperbook/changeset-version.yml)
[![GitHub stars](https://img.shields.io/github/stars/openpatch/hyperbook.svg?label=github%20stars)](https://github.com/openpatch/hyperbook)
[![GitHub Contributors](https://img.shields.io/github/contributors/openpatch/hyperbook.svg?)](https://github.com/openpatch/hyperbook/graphs/contributors)
[![License](https://img.shields.io/github/license/openpatch/hyperbook)](https://github.com/openpatch/hyperbook)

Complete tooling for authoring Hyperbooks in Visual Studio Code. This extension provides live preview, snippets, auto-completion, syntax highlighting, and schema validation for Hyperbook projects.

All you need for writing Hyperbooks (auto preview, snippets, auto-completion and more).

## Features

### Preview

You can preview your Hyperbook pages by clicking the preview icon in the top right-hand corner or by running the command `Show side preview`.

![Preview](https://github.com/openpatch/hyperbook/raw/main/platforms/vscode/screenshots/preview.gif)

### Element runtimes

To keep the extension small, it does not include the large runtimes of Pyodide,
Typst, GeoGebra, OpenSCAD, Excalidraw, Blockflow, the Online IDE, and the SQL
IDE. The preview resolves them like a Hyperbook build:

- If your `hyperbook.json` sets `cdn` for an element, the preview loads it from
  that CDN.
- Otherwise the preview uses the runtime from the Hyperbook CLI's asset cache.
  The extension and the CLI share this folder, so a runtime downloaded by
  either one works for both.
- A runtime that is not downloaded yet loads from the element's default CDN.
  The preview offers to download it.

To download runtimes for offline use, run **Hyperbook: Download Element
Runtimes...** or **Hyperbook: Download All Element Runtimes**. They work like
`hyperbook assets fetch` and `hyperbook assets fetch --all`. Downloads are
verified with SHA-256 and stored in the CLI's cache folder: `~/.cache/hyperbook/assets`
on Linux, `~/Library/Caches/hyperbook/assets` on macOS, and
`%LOCALAPPDATA%\hyperbook\assets` on Windows. `HYPERBOOK_ASSET_CACHE` and
`XDG_CACHE_HOME` change it, as for the CLI.

### Hyperbook Config

The `hyperbook.json` is validated against a schema, which presents you
from making mistakes. It also enables a color picker for your brand
color.

![Config](https://github.com/openpatch/hyperbook/raw/main/platforms/vscode/screenshots/config.gif)

### Syntax Highlighting

Each element has its own syntax highlighting. So you know when you typed it right.

### Snippets

Each element can be inserted by using a snippet. Type `:` and hit your auto-completion key combo (default Ctrl+Space).

![](https://github.com/openpatch/hyperbook/raw/main/platforms/vscode/screenshots/snippets.gif)

### Auto completion

![](https://github.com/openpatch/hyperbook/raw/main/platforms/vscode/screenshots/autocomplete.gif)

- Glossary terms

  - Move your cursor between the curly braces of a term/t element, e.g.: `:t[My term]{`
  - Type `#` to trigger the completion

- Link to book pages
  - Type `/` to trigger the completion
- Link to files in the public folder
  - Type `/` to trigger the completion
- Archives
  - Move your cursor in the src parameter of an archive element, e.g.: `:archive[My archive]{src=`
  - Type `"` to trigger the completion

## Changelog

See [CHANGELOG](https://github.com/openpatch/hyperbook/blob/main/platforms/vscode/CHANGELOG.md) for more information.
