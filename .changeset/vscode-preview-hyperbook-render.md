---
"hyperbook": patch
"hyperbook-studio": patch
---

The VS Code preview now renders pages through the same single-page builders as `hyperbook render` (the command Hyperbook Cloud's editor preview runs), instead of calling the markdown pipeline with its own hand-rolled context. The preview therefore shows exactly what a build produces — same shell, navigation, version footer and diagnostics — while keeping its webview-friendly URLs (assets as webview URIs, page links opening the file in the editor). `SinglePageResult` additionally exposes the raw pipeline messages (`rawMessages`) so the preview can map them onto editor squiggles.
