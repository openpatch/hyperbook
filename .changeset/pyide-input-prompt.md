---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Show the Python `input()` prompt message in the browser dialog.

When a Python script calls `input("Zahl eingeben: ")`, the prompt text is now passed through to the browser's `window.prompt()` dialog instead of always showing the generic "Input required:" message.
