# Hyperbook Support for Visual Studio Code

[![version](https://img.shields.io/vscode-marketplace/v/openpatch.hyperbook-studio.svg?label=version)](https://marketplace.visualstudio.com/items?itemName=openpatch.hyperbook-studio)
[![installs](https://img.shields.io/vscode-marketplace/d/openpatch.hyperbook-studio.svg?label=installs)](https://marketplace.visualstudio.com/items?itemName=openpatch.hyperbook-studio)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/openpatch/hyperbook/Create%20Pull%20Request%20or%20Release)](https://github.com/openpatch/hyperbook/actions)
[![GitHub stars](https://img.shields.io/github/stars/openpatch/hyperbook.svg?label=github%20stars)](https://github.com/openpatch/hyperbook)
[![GitHub Contributors](https://img.shields.io/github/contributors/openpatch/hyperbook.svg?)](https://github.com/openpatch/hyperbook/graphs/contributors)
[![License](https://img.shields.io/github/license/openpatch/hyperbook)](https://github.com/openpatch/hyperbook)

All you need for writing Hyperbooks (auto preview, snippets, auto-completion and more).

## Features

### Preview

You can preview your Hyperbook pages by clicking the preview icon in the top right-hand corner or by running the command `Show side preview`.

### Hyperbook Config

The `hyperbook.json` is validated against a schema, which presents you
from making mistakes. It also enables a color picker for your brand
color.

### Syntax Highlighting

Each element has its own syntax highlighting. So you know when you typed it right.

### Snippets

Each element can be inserted by using a snippet. Type `:` and hit your auto-completion key combo (default Ctrl+Space).

### Auto completion

- Glossary terms
  - Move your cursor between the curly braces of a term/t element, e.g.: `:t[My term]{`
  - Type `#` and hit your key combo for auto-completion (Default Ctrl+Space)
- Link to book pages
  - For this to work you need to disable `Markdown Suggest Paths` (markdown.suggest.paths.enabled).
  - Type `/` and hit your key combo for auto-completion (Default Ctrl+Space)
- Link to files in the public folder
  - For this to work you need to disable `Markdown Suggest Paths` (markdown.suggest.paths.enabled).
  - Type `/` and hit your key combo for auto-completion (Default Ctrl+Space)
- Archives
  - Move your cursor in the src parameter of an archive element, e.g.: `:archive[My archive]{src="`
  - Type `/` and hit your key combo for auto-completion (Default Ctrl+Space)

## Changelog

See [CHANGELOG](CHANGELOG.md) for more information.
