---
"@hyperbook/cloud": minor
"@hyperbook/markdown": minor
"hyperbook": minor
---

Blockflow projects get visual editors in Hyperbook Cloud, on the blockflow v0.2.0 runtime. A `.sb3` file opens in blockflow's embed editor (`embed-editor.html`) and a `.blockflow` project file in the embed generator (`embed-generator.html`); both are served on the admin origin at `/blockflow/*` from the runtime bundle extracted per Hyperbook version (the same bytes the books render with), under their own Content-Security-Policy, and the editor frame talks blockflow's embed protocol (`ready`/`load`/`change`/`save`/`saved`/`error`) instead of touching the editor's VM. "Edit visually" in a page now also works on `::blockflow-player{src=…}` and `::::blockflow-editor{src=…}`/`{project=…}`. A `.sb3` travels base64-encoded and saves with `encoding: "base64"`, a `.blockflow` is plain JSON; both validate before saving, and "New file" offers starters for them. `@hyperbook/markdown` pins `blockflow-v0.2.0`, whose bundle adds the embed entries and a `manifest.json` (version, commit, entries) that a test asserts.
