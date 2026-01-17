# Hyperbook

Hyperbook is a quick and easy way to build interactive workbooks, that
support modern standards and runs superfast.

- **Documentation**: https://hyperbook.openpatch.org
- **Repository:** https://github.com/openpatch/hyperbook
- **Community**: https://matrix.to/#/#openpatch:matrix.org

## Packages

This monorepo contains the following packages:

### Core Packages

- **[hyperbook](packages/hyperbook)** - Main CLI tool for creating, building, and serving Hyperbook projects
- **[@hyperbook/markdown](packages/markdown)** - Markdown processing engine with 30+ custom directives
- **[@hyperbook/fs](packages/fs)** - File system utilities for managing Hyperbook projects
- **[@hyperbook/types](packages/types)** - TypeScript type definitions for the Hyperbook ecosystem
- **[create-hyperbook](packages/create)** - Interactive CLI for scaffolding new Hyperbook projects

### Components

- **[@hyperbook/web-component-excalidraw](packages/web-component-excalidraw)** - Excalidraw web component for diagrams

### Platforms

- **[hyperbook-studio](platforms/vscode)** - Visual Studio Code extension with preview, snippets, and validation

## Documentation

If you want to work on the documentation, run the
development server and edit the files in the website folder.

```
pnpm install
pnpm build
pnpm website:dev
```

## VSCode Extension

If you want to work the vscode extension:

```
pnpm install
pnpm build
pnpm --filter hyperbook-studio watch
pnpm --filter hyperbook-studio open
```

## Maintainer

Mike Barkmin • [Mastodon](https://bildung.social/@mikebarkmin) • [GitHub](https://github.com/mikebarkmin/)

## Support

We are [happy to hear from you](mailto:contact@openpatch.org), if you need custom support or features for your application.

---

Hyperbook is maintained by [OpenPatch](https://openpatch.org), an organization for educational assessments and training. If you need help or you created a Hyperbook [get in touch](mailto:contact@openpatch.org).
