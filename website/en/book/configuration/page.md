---
name: Page Configuration
index: 1
lang: de
---

# Page Configuration

A page is a markdown file. It consists of a frontmatter and a content.

The frontmatter gives Hyperbook some information to work with. The frontmatter is at the very top of the markdown file and is fenced by three ---.

```md
---
name: The Name of a Page
---

# A Headline

And some content
```

Here are the properties you can set in the frontmatter:

| Property    | Description                                                                                                                         |
| :---------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| name        | Name of the page used in the navigation                                                                                             |
| description | Description of the page used for SEO                                                                                                |
| permaid     | An id which will make the page also available at e.g. /@/audio, when setting permaid to audio |
| keywords    | A list of keywords used for SEO                                                                                                     |
| index       | A number indicating the position in the menu in relation to pages on the same level                                                 |
| prev        | The absolute path to the prev page or a absolute path to a permaid e.g. /@/audio. This overrides index and hide. You can also set it to nothing and it will hide the prev button. |
| next        | The absoulte path to the next page or a absolute path to a permaid e.g. /@/audio. This overrides index and hide. You can also set it to nothing and it will hide the next button. |
| hide        | Hides the page from the navigation                                                                                                  |
| toc         | Show or hide a table of content for the page. This is on for pages and off for glossary entries by default                          |
| layout      | Choose the page layout. Options: `default` (standard layout with sidebar) or `wide` (full-width content with navigation always in drawer mode) |
| styles            | Here you can add Links to custom CSS files. |
| scripts            | Here you can add links to custom JavaScript files. |
| qrcode | Shows an icon, which opens a qr code to this page. |
