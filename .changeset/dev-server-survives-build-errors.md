---
"@hyperbook/fs": patch
hyperbook: patch
---

**dev**: A build failure no longer takes the dev server down with it.

`hyperbook dev` used to exit when the initial build threw, so the author fixed
the file against a dead port and started over. The server now starts anyway,
prints the failure, and serves it: routes the broken build never wrote answer
with an error page, pages still standing from an earlier build get the overlay
as soon as they connect, and the save that fixes the problem rebuilds and
reloads everything. A first build that failed also no longer pins the session
to full rebuilds — incremental mode takes over once a build succeeds.

**frontmatter**: A page whose frontmatter is not valid YAML now names the file
and the line. The parser's own complaint ("incomplete explicit mapping pair")
arrived with no indication of which page it came from; it now comes with
`path:line:column`, the offending line with a caret under it, and — for the
mistake that causes most of these — the quoted form that fixes it:

```
error book/tokenisierung.md:2:22
incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line
2 | title: Text als Daten: Tokenisierung
                         ^

A value containing ": " has to be quoted: title: "Text als Daten: Tokenisierung"
```
