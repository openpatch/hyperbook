---
"@hyperbook/cloud": patch
"@hyperbook/markdown": patch
"hyperbook": patch
---

The editor's preview pane shows the whole page — header, navigation and footer — like readers will see it. Pages in an iframe used to switch to standalone (content-only) mode automatically; a new `standalone=false` URL parameter keeps the shell, and the preview pane adds it to every page it frames.
