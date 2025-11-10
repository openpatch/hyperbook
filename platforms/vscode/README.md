# Hyperbook Support for Visual Studio Code

[![version](https://img.shields.io/vscode-marketplace/v/openpatch.hyperbook-studio.svg?label=version)](https://marketplace.visualstudio.com/items?itemName=openpatch.hyperbook-studio)
[![installs](https://img.shields.io/vscode-marketplace/d/openpatch.hyperbook-studio.svg?label=installs)](https://marketplace.visualstudio.com/items?itemName=openpatch.hyperbook-studio)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/openpatch/hyperbook/changeset-version.yml)
[![GitHub stars](https://img.shields.io/github/stars/openpatch/hyperbook.svg?label=github%20stars)](https://github.com/openpatch/hyperbook)
[![GitHub Contributors](https://img.shields.io/github/contributors/openpatch/hyperbook.svg?)](https://github.com/openpatch/hyperbook/graphs/contributors)
[![License](https://img.shields.io/github/license/openpatch/hyperbook)](https://github.com/openpatch/hyperbook)

All you need for writing Hyperbooks (auto preview, snippets, auto-completion and more).

## Getting Started

New to Hyperbook? Open the **Getting Started** walkthrough to learn the basics:

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run "Welcome: Open Walkthrough..."
3. Select "Getting Started with Hyperbook"

The walkthrough will guide you through:
- Creating your first Hyperbook
- Editing pages
- Using snippets
- Customizing frontmatter
- And more!

## Features

### Preview

You can preview your Hyperbook pages by clicking the preview icon in the top right-hand corner or by running the command `Show side preview`.

![Preview](https://github.com/openpatch/hyperbook/raw/main/platforms/vscode/screenshots/preview.gif)

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
