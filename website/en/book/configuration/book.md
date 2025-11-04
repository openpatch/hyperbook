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
