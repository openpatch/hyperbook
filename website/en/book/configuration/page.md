---
name: Page Configuration
index: 1
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

| Property    | Description                                                                                                |
| :---------- | :--------------------------------------------------------------------------------------------------------- |
| name        | Name of the page used in the navigation                                                                    |
| description | Description of the page used for SEO                                                                       |
| keywords    | A list of keywords used for SEO                                                                            |
| index       | A number indicating the position in the menu in relation to pages on the same level                        |
| hide        | Hides the page from the navigation                                                                         |
| toc         | Show or hide a table of content for the page. This is on for pages and off for glossary entries by default |
