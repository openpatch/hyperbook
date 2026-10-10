---
name: Book Configuration
index: 0
---

# Book Configuration

In your new Hyperbook project you will find a `hyperbook.json` file.
This file is for configuring Hyperbook. Here is a list of options you
can and part wise must set (indicated by a \*).

| Property           | Description                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name\*             | Name of your Hyperbook. Used for the page header.                                                                                                               |
| description        | Description of your Hyperbook. Used for SEO.                                                                                                                    |
| search             | Allows searching your hyperbook                                                                                                                                 |
| logo               | URL to a logo. Used for the page title. Can be relative to the public folder or an absolute URL                                                                 |
| author.name        | Author name of your Hyperbook. Used in the footer.                                                                                                              |
| author.url         | Used to link the author name in the footer.                                                                                                                     |
| font               | URL to a font. Used for headings and body. You can add ":90%" for adjusting the font size.                                                                      |
| fonts.heading      | URL to a font. Used for headings. You can add ":90%" for adjusting the font size.                                                                               |
| fonts.body         | URL to a font. Used for body. You can add ":90%" for adjusting the font size.                                                                                   |
| fonts.code         | URL to a font. Used for code. You can add ":90%" for adjusting the font size.                                                                                   |
| colors.brand       | The color for the header and the accents for example on links.                                                                                                  |
| colors.brandDark   | The color for the header and the accents for example on links, if the user prefers a dark theme. Brand text is not used for the dark theme.                     |
| colors.brandText   | The color for the text in the header                                                                                                                            |
| basePath           | When deploying to a subdirectory, for example on GitHub pages, you can set a base path.                                                                         |
| license            | License under the Hyperbook is published.                                                                                                                       |
| language           | The language of the Hyperbook.                                                                                                                                  |
| repo               | The link to the GitHub repo. Used for showing an edit button. The %path% placeholder will be replaced by the current path or the current path will be appended. |
| repo.url           | The link to the repo. Used for showing an edit button. The %path% placeholder will be replaced by the current path or the current path will be appended.        |
| repo.label         | The label for the repo link.                                                                                                                                    |
| elements           | Here you can configure the elements. See the element pages for configuration options.                                                                           |
| links              | Here you can add custom links, which will be shown in the top right corner. See the example below on how to use them.                                           |
| styles             | Here you can add Links to custom CSS files.                                                                                                                     |
| scripts            | Here you can add links to custom JavaScript files.                                                                                                              |
| allowDangerousHtml | Allow HTML. This can lead to incompatibilities in future versions.                                                                                              |
| qrcode             | Shows an icon, which opens a qr code to the current page.                                                                                                       |
| toc         | Show or hide a table of content for the page. This is on for pages and off for glossary entries by default                          |
| llms               | When set to true, generates an llms.txt file that combines all markdown files in order. The file includes the book name and version in a header format.         |
| trailingSlash      | Outputs all files into ther own folders and produces only index.html files.                                                                                     |
| importExport       | Allows to import and export the state of the Hyperbook as a file. Buttons for importing and exporting will be at the bottom of the page.                        |
| cloud.url          | URL of your [Hyperbook Cloud](/configuration/cloud) server. Enables student login and cloud sync.                                                               |
| cloud.id           | The hyperbook slug/ID on the cloud server. Must match the slug configured in the cloud admin interface.                                                         |
| version | Configure where the version of the Hyperbook is shown. "text" show it under the Powered by Hyperbook text. "tooltip" as a tooltip when hovering the Powered by Hyperbook text and "console" only in the console. |

Here is an example configuration:

```json
{
  "name": "Hyperbook Documentation",
  "description": "Documentation for Hyperbook created with Hyperbook",
  "search": true,
  "qrcode": false,
  "author": {
    "name": "OpenPatch",
    "url": "https://openpatch.org"
  },
  "font": "/fonts/my-font.woff2:90%",
  "logo": "/logo.png",
  "license": "CC-BY-SA",
  "language": "en",
  "basePath": "/hyperbook-github-pages",
  "repo": {
    "url": "https://github.com/mikebarkmin/hyperbook-github-pages/edit/main/%path%",
    "label": "Edit on GitHub"
  },
  "colors": {
    "brand": "#FF0000"
  },
  "cloud": {
    "url": "https://cloud.example.com",
    "id": "my-hyperbook"
  },
  "elements": {
    "bookmarks": false
  },
  "links": [
    {
      "label": "Contact",
      "links": [
        {
          "label": "Mail",
          "icon": "📧",
          "href": "mailto:contact@openpatch.org"
        },
        {
          "label": "Twitter",
          "icon": "🐦",
          "href": "https://twitter.com/openpatchorg"
        },
        {
          "label": "Mastodon",
          "icon": "🐘",
          "href": "https://fosstodon.org/@openpatch"
        },
        {
          "label": "Matrix (Chat)",
          "icon": "👨‍💻",
          "href": "https://matrix.to/#/#hyperbook:matrix.org"
        }
      ]
    },
    {
      "label": "OpenPatch",
      "href": "https://openpatch.org"
    }
  ]
}
```

## Local assets and CDNs

Hyperbook downloads large element runtimes when they are first needed and copies
them into the build. To load a runtime from a CDN instead, set `cdn` in its
element configuration:

```json
{
  "name": "My Hyperbook",
  "elements": {
    "pyide": { "cdn": true },
    "typst": { "cdn": "https://assets.example.com/directive-typst/" },
    "geogebra": { "cdn": true },
    "openscad": { "cdn": false }
  }
}
```

| Value | Behavior |
| --- | --- |
| Omitted or `false` | Download and include the runtime in the build. This is the default. |
| `true` | Load the runtime from its default CDN. |
| An HTTP(S) base URL | Load the runtime from your own server or CDN. |

This option is available for `pyide`, `typst`, `geogebra`, `openscad`,
`excalidraw`, `onlineide`, `sqlide`, and `blockflow`. The `blockflow` setting
applies to both the player and editor. Kiri:Moto continues to use its external
service.

The default CDNs are jsDelivr for Pyodide and Typst, GeoGebra's server for
GeoGebra, the hosted Blockflow app at `blockflow.openpatch.org` for Blockflow,
Excalidraw's own packages on UNPKG for Excalidraw, and UNPKG's versioned
Hyperbook assets for OpenSCAD, the Online IDE, and the SQL IDE. Hyperbook's
small integration scripts and styles stay in the build.

The Hyperbook extension for VS Code does not include these runtimes. Its
preview loads them from the default CDN unless `cdn` is set to a custom URL, so
previewing these elements needs an internet connection.

A custom URL must point to the contents of the corresponding
`__hyperbook_assets/directive-<element>/` directory from a local build. Preserve
its subdirectories. For `pyide`, point directly to the Pyodide distribution
directory containing `pyodide.js` and `pyodide-lock.json`, such as
`https://assets.example.com/pyodide/`.

If a custom CDN URL has a different origin from the book (domain, port, or
protocol), its asset server must allow cross-origin requests, for example with
`Access-Control-Allow-Origin: *`. Locally bundled assets and custom URLs on the
book's own origin need no extra CORS headers. If the book uses HTTPS, its CDN
URLs must use HTTPS too.

CDN-enabled runtimes are skipped by `hyperbook assets fetch` and do not need to
be cached for `hyperbook build --offline`. Readers still need access to the
configured CDN. `hyperbook assets fetch --all` downloads every runtime,
regardless of the element configuration.
