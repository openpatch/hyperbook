# Hyperbook Support for Visual Studio Code

[![version](https://img.shields.io/vscode-marketplace/v/openpatch.hyperbook-studio.svg?label=version)](https://marketplace.visualstudio.com/items?itemName=openpatch.hyperbook-studio)
[![installs](https://img.shields.io/vscode-marketplace/d/openpatch.hyperbook-studio.svg?label=installs)](https://marketplace.visualstudio.com/items?itemName=openpatch.hyperbook-studio)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/openpatch/hyperbook/changeset-version.yml)
[![GitHub stars](https://img.shields.io/github/stars/openpatch/hyperbook.svg?label=github%20stars)](https://github.com/openpatch/hyperbook)
[![GitHub Contributors](https://img.shields.io/github/contributors/openpatch/hyperbook.svg?)](https://github.com/openpatch/hyperbook/graphs/contributors)
[![License](https://img.shields.io/github/license/openpatch/hyperbook)](https://github.com/openpatch/hyperbook)

All you need for writing Hyperbooks (auto preview, snippets, auto-completion and more).

## Features

### Create New Hyperbook

You can create a new Hyperbook project directly from VS Code by running the command `Create new Hyperbook` from the Command Palette (Ctrl+Shift+P / Cmd+Shift+P).

The command will guide you through a multi-step wizard to:
1. Select the parent folder where your Hyperbook will be created
2. Choose a name for your book
3. Provide a description (optional)
4. Enter the author's name
5. Set the author's homepage URL (optional)
6. Select a license (Creative Commons, Custom, etc.)
7. Choose the book's language
8. Select a publishing platform (GitHub, GitLab, EduGit, Vercel, or Custom)

After completion, you can open the newly created Hyperbook folder in VS Code.

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
