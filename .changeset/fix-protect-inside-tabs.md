---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Fix protect directive not revealing content when wrapping tabs or other directives containing input elements. The password input selector now scopes to the direct child `.password-input` container instead of selecting the first input in the entire subtree.
