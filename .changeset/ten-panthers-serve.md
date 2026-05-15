"@hyperbook/markdown": patch
"hyperbook": patch
---

Fix pyide editors restoring saved code when the `code-input_load` event fires before the restore handler is attached.
