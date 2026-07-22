---
"@hyperbook/markdown": patch
"hyperbook": patch
---

**navigation**: A section that links to its own page is now distinguishable from one that only expands. Sections whose `index.md` is empty are set in italics, and the title of a section that does have a page underlines on hover to show it is a link. Each subsection is judged on its own content rather than inheriting its parent's styling.

This also repairs the highlight of the section you are currently on. The stylesheet still looked for `active` and `empty` on the `<summary>` element, but they moved to the surrounding `<details>` when sections became collapsible, so those rules had stopped matching.
