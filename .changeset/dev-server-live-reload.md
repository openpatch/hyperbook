---
"hyperbook": patch
---

Fix several problems in the dev server's live reload.

A hyperlibrary watched nothing but its own `hyperlibrary.json`: the watch list only covered
entries at the project root, while a library keeps its books in subdirectories. Every sub-project
now contributes its own watched entries, and the decision is made per path, so a `snippets/`
folder created while the server is running is picked up too.

`hyperbook dev` also now waits for the watcher's initial scan before reporting that it is running,
so an edit made in the first moments after startup is no longer missed.

When a page changes, the browser swaps `<main>` in place instead of reloading. That is only sound
for a page with no directives on it, and it is now limited to exactly that case.

A directive ships its stylesheet and bundle outside `<main>`, and its client script initialises
either on `DOMContentLoaded` or from a MutationObserver that only inspects the nodes directly
inserted — not their descendants, which is all an `innerHTML` swap produces. Neither can be
replayed into a page that is already live, so a swapped-in mermaid diagram arrived as raw source
that nothing rendered, and a directive used on the page for the first time rendered inert. Both
cases now fall back to a real reload, as does a page whose structure changed. Plain prose, the case
the swap is actually for, still swaps: scroll position and page state are kept, and the document
title follows.

Two further problems with the swap are fixed: the rebuild button kept spinning and stayed disabled
forever, because the full reload that used to reset it never happened; and re-running the scripts
in the new content also replaced the `<script type="text/plain">` and `<script
type="application/json">` payloads that online-ide, sql-ide and protect blocks carry, pulling the
data out from under a custom element that had already read it. Only executable scripts are re-run
now, and a bundle that is already loaded is not run a second time.

The dev client connects to the page's own origin rather than a hardcoded `localhost`, so live
reload works when a book is opened from another device or through a proxy, and `Content-Length`
for the client script counts bytes rather than characters, which had been clipping its tail.

When one file in a batch fails to build, the rest of the batch is retried instead of being
dropped and left stale until touched again.

File watching uses native filesystem events instead of polling every 600ms, so changes are picked
up immediately and an idle dev server no longer spins the CPU. On network filesystems where
inotify and FSEvents do not fire — Docker volumes, WSL2, NFS — set `HYPERBOOK_POLLING=1` to
restore polling.

Pages affected by one change are rebuilt concurrently, and concurrent rebuilds no longer race each
other copying the same directive and emoji assets into the same destination.
