---
"@hyperbook/types": minor
"@hyperbook/fs": minor
"@hyperbook/markdown": minor
"hyperbook": minor
"hyperbook-studio": minor
---

Order pages and sections together by `index`. Pages were always rendered before
the sections of the same level, so a page could not sit after or between them.
The `index` of a page and the `index` of a section are now one order, and a
section that ends up between two pages is rendered between them.

The reading order follows the navigation, so the previous and next buttons, the
breadcrumb and `::pagelist` agree with the sidebar.

A page or a section without an `index` keeps its old place: pages come before
sections, and a page wins a tie against a section. A book that gives its
sections an `index` but leaves it off a page will see that page move behind
those sections. Give the page an `index` to place it.
