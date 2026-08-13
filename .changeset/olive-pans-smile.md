---
"@hyperbook/markdown": minor
"@hyperbook/fs": minor
"hyperbook": minor
---

Make books lighter and printable, stop losing reader input, and start showing
the diagnostics the build already produced.

**The search index no longer loads on every page.** It was linked from the head
of every page whether or not the reader opened search — 2.9 MB on this
repository's own documentation, out of 3.1 MB of JavaScript per page view. It
is fetched on the first search now, which leaves 284 KB. The index is also
parsed once and kept, rather than rebuilt on every query, which made
search-as-you-type and a `/` shortcut worth adding.

**Interactive directives keep their id when the page around them is edited.**
The id a directive stores reader input under was derived from a hash that
included the node's position in the file, so inserting a paragraph above a
`::textinput` changed it and silently orphaned every answer already written
into it. Ids now come from the directive's own content. Books built with an
older version are migrated on first load, so no existing work is lost.

**Books can be printed.** There was no print stylesheet at all, and because the
reading layout is a fixed grid whose article pane scrolls, printing a chapter
produced roughly one sheet. The rest is on paper now: the layout unwinds into
normal flow, the interface is dropped, collapsed sections and every tab panel
open, dark mode is not carried onto paper, and text a reader has typed into a
`::textinput` prints in full instead of being cut off at the box.

**The markdown plugins' diagnostics are printed.** Messages such as
`Unexpected "::alert" leaf directive, use three colons` were produced on every
build and then discarded — nothing read `vfile.messages`. They now appear
during `hyperbook build`, in `hyperbook dev` (in the terminal and as an overlay
in the browser), and as squiggles in the VS Code preview.

**A new `hyperbook check` command** verifies that internal links and images
resolve, that no two pages claim the same `permaid`, and that `hyperbook.json`
has no options Hyperbook does not know about. It exits non-zero, so it can gate
CI before a build.

**Every directive now accepts the forms it actually supports.** Several
asserted a single form and reported correct usage as a mistake: `geogebra`,
`struktolab`, `p5` and the code editors (`pyide`, `webide`, `typst`,
`openscad`) take either a body or an attribute, and `archive` and `download`
work inline in a sentence as well as standalone. Three checks could never fire
at all. `mermaid`'s now does.

Also fixed: a book without a `language` was announced as Spanish to screen
readers; the search field had no placeholder or label; `hyperbook dev -p 3000`
searched from port 30001 when 3000 was busy; the "new version available" notice
could never print; and a malformed `hyperbook.json` reported
`Missing or invalid hyperbook.json/hyperlibray.json` instead of the line the
error is on.
