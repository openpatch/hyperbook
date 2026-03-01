---
"hyperbook": minor
---

Add incremental dev rebuilds for faster browser updates. Content changes now only rebuild the affected page instead of the entire site. Structural changes (file add/delete) and config changes still trigger a full rebuild. Enhanced WebSocket protocol sends targeted reload messages so the browser only refreshes when the current page is affected. Added a force full rebuild button in the bottom-right corner that spins during rebuilds. The file watcher now ignores dotfiles (.git) and node_modules. Fixed lunr language plugin "Overwriting" warnings.
