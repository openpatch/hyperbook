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

This generates a static site in the `public` directory ready for deployment.

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
└── public/                 # Built output (after build)
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
