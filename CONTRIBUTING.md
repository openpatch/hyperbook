# Contributing to Hyperbook

Thank you for your interest in contributing to Hyperbook! This document provides guidelines and instructions for contributing to the project.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or higher
- **pnpm** 8 or higher (required package manager)

To install pnpm globally:
```bash
npm install -g pnpm
```

### Setting Up Your Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/openpatch/hyperbook.git
   cd hyperbook
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build all packages**
   ```bash
   pnpm build
   ```

4. **Run tests to verify setup**
   ```bash
   pnpm test
   ```

## Repository Structure

Hyperbook is a monorepo with the following structure:

- `packages/hyperbook/` - Main CLI tool and builder
- `packages/fs/` - File system operations and configuration handling
- `packages/markdown/` - Markdown processing with custom directives
- `packages/types/` - TypeScript type definitions
- `packages/web-component-excalidraw/` - Excalidraw integration component
- `platforms/vscode/` - VSCode extension
- `website/` - Documentation website (self-documenting)
- `scripts/` - Build and utility scripts

## Development Workflow

### Building Packages

Build all packages in the monorepo:
```bash
pnpm build
```

Build a specific package:
```bash
pnpm --filter hyperbook build
pnpm --filter @hyperbook/fs build
```

Watch mode for development (watches all packages):
```bash
pnpm dev
```

### Running Tests

Run all tests:
```bash
pnpm test
```

Run tests for a specific package:
```bash
pnpm --filter hyperbook test
```

### Linting

Run linting across all packages:
```bash
pnpm lint
```

## Working on Specific Areas

### Documentation

To work on the documentation website:

```bash
pnpm install
pnpm build
pnpm website:dev
```

Edit files in the `website/` folder. The documentation is available in English (`website/en/`) and German (`website/de/`).

### VSCode Extension

To develop the VSCode extension:

```bash
pnpm install
pnpm build
pnpm --filter hyperbook-studio watch
pnpm --filter hyperbook-studio open
```

This will open a new VSCode window with the extension loaded for testing.

## Submitting Changes

### Before Submitting a Pull Request

1. **Ensure all tests pass**
   ```bash
   pnpm test
   ```

2. **Build all packages successfully**
   ```bash
   pnpm build
   ```

3. **Run linting**
   ```bash
   pnpm lint
   ```

4. **Commit your changes**
   
   We use Husky pre-commit hooks that run tests automatically. Ensure your commits pass all checks.

### Pull Request Guidelines

- Create a clear, descriptive title for your PR
- Provide a detailed description of the changes and why they're needed
- Reference any related issues using GitHub keywords (e.g., "Fixes #123")
- Keep PRs focused on a single feature or fix
- Update documentation if your changes affect user-facing functionality
- Add tests for new features or bug fixes

### Changesets

We use [Changesets](https://github.com/changesets/changesets) for version management. If your PR includes user-facing changes:

1. **Add a changeset**
   ```bash
   pnpm changeset
   ```

2. Follow the prompts to describe your changes

3. Commit the generated changeset file with your PR

## Code Style

- We use Prettier for code formatting
- TypeScript is required for all new code
- Follow existing code patterns and conventions
- Write clear, descriptive variable and function names
- Add comments only when necessary to clarify complex logic

## Community

- **Matrix Chat**: https://matrix.to/#/#openpatch:matrix.org
- **Documentation**: https://hyperbook.openpatch.org
- **Issues**: https://github.com/openpatch/hyperbook/issues

## Getting Help

If you need help or have questions:

- Check the [documentation](https://hyperbook.openpatch.org)
- Ask in our [Matrix community](https://matrix.to/#/#openpatch:matrix.org)
- Open an issue on GitHub
- Contact the maintainer: Mike Barkmin ([@mikebarkmin](https://github.com/mikebarkmin))

## License

By contributing to Hyperbook, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Hyperbook! Your efforts help make interactive documentation better for everyone.
