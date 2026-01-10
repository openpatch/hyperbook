---
name: Section Configuration
index: 2
---

# Section Configuration

Each folder inside `book` defines a section. Each folder must contain a `index.md`. The index file
can be configured like a [page](/configuration/page).

You can also make folders `virtual`. If a folder is declared virtual,
the folder will not create another level. This is helpful if you want
to structure your hyperbook with folders, but they should not affect the
navigation.

To summarize, here are the properties you can set in the frontmatter:

| Property   | Description                                                                                                            |
| :--------- | :--------------------------------------------------------------------------------------------------------------------- |
| ...        | Every Property from a [page](/configuration/page)                                                                      |
| virtual    | Everything will appear on the same level as the parent. Be aware that the index property does not work across folders. (deprecated, use `navigation: virtual` instead) |
| expanded   | Defines whether the section is expanded on page load. (deprecated, use `navigation: expanded` instead)                 |
| navigation | Controls how the section appears in navigation. Options: `default` (collapsible section), `hidden` (hides from navigation), `virtual` (items appear at parent level), `page` (renders as a regular page link without showing children), `expanded` (section is expanded by default) |

If the `index.md` file only contains a front matter and is otherwise
empty, it will appear in the navigation as a non-clickable item.
