# Hyperbook Copilot Instructions

## Repository Overview

**Hyperbook** is a TypeScript/Node.js tool for building interactive workbooks and documentation. This is a monorepo containing ~22,000 lines of code that supports modern web standards and includes features like embedded code execution environments, interactive elements, and multi-language support.

### High-level Information
- **Type**: CLI tool and web framework for interactive documentation
- **Languages**: TypeScript (primary), JavaScript, HTML, CSS, Markdown
- **Runtime**: Node.js 18+ required, browser runtime for built output
- **Package Manager**: pnpm (required, version 8+)
- **Build System**: esbuild (via custom scripts), TypeScript compilation, Vite
- **Architecture**: Monorepo with 6 packages, 1 platform, and self-documenting website

## Build and Development Instructions

### Prerequisites
**ALWAYS** ensure these are installed before any operations:
```bash
# Install pnpm if not available
npm install -g pnpm@9.1.1

# Verify versions
node --version  # Should be 18+
pnpm --version  # Should be 8+
```

### Essential Build Sequence
**CRITICAL**: Always follow this exact sequence. Package dependencies require specific build order.

```bash
# 1. Install dependencies (ALWAYS run first)
pnpm install

# 2. Build packages in dependency order
cd packages/types && pnpm build                          # No dependencies
cd packages/fs && pnpm build                             # Depends on types
cd packages/web-component-excalidraw && pnpm build       # No dependencies, needed by markdown
cd packages/markdown && pnpm build                       # Depends on types, includes emoji prebuild
cd packages/hyperbook && pnpm build                      # Depends on fs, markdown, types

# 3. Full monorepo build (after individual packages work)
pnpm build

# 4. Run tests
pnpm test

# 5. Run linting
pnpm lint  # May have TypeScript errors in excalidraw package (non-blocking)
```

### Known Build Issues and Workarounds

**TypeScript Errors in web-component-excalidraw**:
- External dependency issues with @excalidraw packages
- These are non-blocking for most development work
- Safe to ignore unless working specifically on Excalidraw integration

**Missing Locales Error**:
- May occur during hyperbook package build
- **Fix**: Ensure `packages/markdown/dist/locales` exists by copying from `packages/markdown/locales`

### Development Commands

```bash
# Start development watcher (watches all packages)
pnpm dev

# Run tests (includes vitest for all packages)
pnpm test

# Run specific package commands
pnpm --filter hyperbook build
pnpm --filter @hyperbook/fs test
pnpm --filter hyperbook-studio watch  # VSCode extension

# Website development (uses built hyperbook CLI)
pnpm website:dev    # Start dev server
pnpm website:build  # Build documentation site

# Platform-specific commands
pnpm platform:vscode:dev  # VSCode extension development
```

### Testing Instructions
- **Test Framework**: Vitest (configured per package)
- **Test Files**: Located in `packages/*/tests/` directories
- **Test Coverage**: Core packages have comprehensive test suites
- **Snapshots**: Some tests use snapshot testing (in `__snapshots__` folders)
- **Test Requirements**: Build packages before running tests
- **CI Environment**: Set `CI=true` for production test runs

## Project Architecture and Layout

### Repository Structure
```
/
├── .github/workflows/           # CI/CD pipelines
├── packages/                   # Core monorepo packages
│   ├── hyperbook/              # Main CLI tool and builder
│   ├── fs/                     # File system operations and hyperbook.json handling
│   ├── markdown/               # Markdown processing with custom directives
│   ├── types/                  # TypeScript type definitions
│   └── web-component-excalidraw/ # Excalidraw integration component
├── platforms/                  
│   └── vscode/                 # VSCode extension for Hyperbook
├── website/                    # Self-documenting website (de/en)
├── scripts/                    # Build and utility scripts
├── plop-templates/             # Code generation templates
└── *.config.json              # Configuration files
```

### Key Packages Description

**packages/hyperbook** (Main CLI):
- Entry point: `index.ts` 
- Commands: `new`, `dev`, `build`
- Dependencies: All other @hyperbook packages
- Build: Uses @vercel/ncc for bundling
- Templates: `templates/default/` for new project scaffolding

**packages/fs**:
- Handles hyperbook.json configuration
- File system operations for content processing
- Navigation and page structure management
- Testing: Extensive test suite with fixtures

**packages/markdown**:
- Custom markdown processing with remark/rehype
- Custom directives (alerts, videos, code environments, etc.)
- Asset management for built-in components
- Localization support (missing translations are non-fatal)

**packages/types**:
- TypeScript definitions for hyperbook.json and internal APIs
- Language definitions and configuration schemas
- Shared types across all packages

### Configuration Files
- `hyperbook.json`: Main project configuration (name, language, styling, etc.)
- `hyperlibrary.json`: Multi-book library configuration
- `tsconfig.base.json`: Base TypeScript configuration
- `pnpm-workspace.yaml`: Monorepo package definitions
- `.github/workflows/`: CI/CD with pnpm, Node.js 22, test + build validation

### Development Environment Setup
1. **Required**: pnpm 8+, Node.js 18+
2. **VSCode**: Configured via `.vscode/` (workspace settings)
3. **Linting**: TypeScript via `tsc --noEmit` in each package
4. **Formatting**: Prettier with `.prettierignore` exclusions
5. **Git Hooks**: Husky pre-commit running `npm test`

### Validation and CI/CD
**GitHub Workflows**:
- `pull-request.yml`: Runs on PRs - installs deps, runs tests, builds all packages
- `changeset-version.yml`: Release automation with changesets, builds VSCode extension

**Pre-commit Validation**:
- Husky hook runs `npm test` 
- Blocks commits if tests fail

**Manual Validation Steps**:
```bash
# Full validation sequence
pnpm install
pnpm build      # All packages
pnpm test       # All test suites
pnpm lint       # TypeScript checking

# CLI functionality test
./packages/hyperbook/dist/index.js --help
./packages/hyperbook/dist/index.js new test-book

# Website build validation
pnpm website:build
```

### Common File Locations
- Main CLI: `packages/hyperbook/index.ts`
- Core types: `packages/types/src/index.ts` 
- Build scripts: `scripts/build.mjs`, `scripts/buildPackage.mjs`
- Templates: `packages/hyperbook/templates/default/`
- Documentation: `website/en/` and `website/de/`
- VSCode extension: `platforms/vscode/src/extension.ts`
- Test fixtures: `packages/*/tests/fixtures/`

### Dependencies and External Integrations
- **Required External**: None (self-contained after build)
- **Build Dependencies**: esbuild, TypeScript, various markdown processing libraries
- **Optional Network**: GitHub emoji fetching (can be disabled)
- **Runtime Platforms**: Node.js CLI, browser for built content, VSCode extension host

## Agent Guidelines

**Trust these instructions** - they are comprehensive and tested. Only explore beyond these instructions if:
- You encounter errors not documented here
- You need to understand specific implementation details not covered
- These instructions appear outdated (check git history for recent changes)

**Always validate changes** by running the build sequence and tests before finalizing any code changes.

**For build failures**: Follow the workarounds exactly as documented - they are battle-tested solutions.