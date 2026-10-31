---
"@hyperbook/markdown": patch
---

Fixed element runtimes a host serves itself (Hyperbook Cloud's shared assets under `/_hyperbook/assets/<version>/`) failing to load on preview and published pages. Their root-relative addresses were buried under the directive's assets folder — a page asked for `/__hyperbook_assets/directive-onlineide/_hyperbook/assets/…/online-ide-embedded.js`, which 404s; browsers refuse the HTML error page as a module ("disallowed MIME type") and the IDE never appears. Directive scripts and styles whose address is already resolved (external or root-relative) now go into the page unchanged.
