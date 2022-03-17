---
name: Book Configuration
index: 0
---

# Book Configuration

In your new Hyperbook project you will find a `hyperbook.json` file.
This file is for configuring Hyperbook. Here is a list of options you
can and part wise must set (indicated by a \*).

| Property         | Description                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| name\*           | Name of your Hyperbook. Used for the page header.                                              |
| description      | Description of your Hyperbook. Used for SEO.                                                   |
| logo             | URL to a logo. Use for the page title. Can be relative to the public folder or an absolute URL |
| author.name      | Author name of your Hyperbook. Used in the footer.                                             |
| author.url       | Used to link the author name in the footer.                                                    |
| colors.brand     | The color for the header and the accents for example on links.                                 |
| colors.brandText | The color for the text in the header                                                           |
| basePath         | When deploying to a subdirectory, for example on GitHub pages, you can set a base path.        |
| license          | License under the Hyperbook is published.                                                      |
| language         | The language of the Hyperbook.                                                                 |
| repo             | The link to the GitHub repo. Used for showing an edit button.                                  |

Here is an example configuration:

```json
{
  "name": "Hyperbook Documentation",
  "description": "Documentation for Hyperbook created with Hyperbook",
  "author": {
    "name": "OpenPatch",
    "url": "https://openpatch.org"
  },
  "logo": "/logo.png",
  "license": "CC-BY-SA",
  "language": "en",
  "basePath": "/hyperbook-github-pages",
  "repo": "https://github.com/mikebarkmin/hyperbook-github-pages/edit/main"
}
```
