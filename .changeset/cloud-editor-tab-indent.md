---
"@hyperbook/cloud": patch
---

The cloud editor indents with Tab and dedents with Shift+Tab again. CodeMirror's basicSetup binds no Tab key, so Tab moved the focus out of the editor instead of indenting.
