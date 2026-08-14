---
"@hyperbook/markdown": patch
"@hyperbook/cloud": patch
hyperbook: patch
---

Restore pull-to-refresh and the collapsing address bar on mobile

On narrow screens the shell no longer pins itself to the viewport. It scrolled
the article pane inside a fixed grid, which left the document scroller
motionless — and a mobile browser drives both pull-to-refresh and the
auto-hiding address bar off that scroller, so neither ever fired. Below 1280px
the layout now flows normally with a sticky header, so the document scrolls and
both gestures work again. The desktop layout, where the sidebar needs to stay
put while the article moves, is unchanged.
