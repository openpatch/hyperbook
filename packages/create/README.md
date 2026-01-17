# create-hyperbook <a href="https://npmjs.com/package/create-hyperbook"><img src="https://img.shields.io/npm/v/create-hyperbook" alt="npm package"></a>

CLI tool for scaffolding new Hyperbook projects. This package provides an interactive prompt-based setup that creates a new Hyperbook project with sample content and configuration.

## Scaffolding Your First Hyperbook Project

> **Compatibility Note:**
> Hyperbook requires [Node.js](https://nodejs.org/en/) version 18+. Please upgrade if your package manager warns about it.

With NPM:

```bash
npm create hyperbook@latest
```

With Yarn:

```bash
yarn create hyperbook
```

With PNPM:

```bash
pnpm create hyperbook
```

With Bun:

```bash
bun create hyperbook
```

Then follow the prompts!

You can also directly specify the project name via the command line. For example, to scaffold a Hyperbook project named "my-documentation", run:

```bash
# npm 7+, extra double-dash is needed:
npm create hyperbook@latest my-documentation

# yarn
yarn create hyperbook my-documentation

# pnpm
pnpm create hyperbook my-documentation

# Bun
bun create hyperbook my-documentation
```

Currently supported template:

- `default` - A basic Hyperbook project with sample content

You can use `.` for the project name to scaffold in the current directory.

## What is Hyperbook?

Hyperbook is a tool for building interactive workbooks and documentation. It provides features like:

- Custom markdown directives for rich content
- Embedded code execution environments
- Multi-language support
- Interactive elements (Excalidraw, videos, alerts, and more)
- Built-in navigation and search
