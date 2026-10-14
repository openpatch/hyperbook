---
"@hyperbook/markdown": patch
"hyperbook": patch
"hyperbook-studio": patch
---

Make the text inputs in the multievent element bigger. On iPads, fields for short answers were barely wider than a single character. Text and number inputs (`{t{…}}`, `{T{…}}`, `{l{…}}`, `{L{…}}`, `{y{…}}`, `{Y{…}}`, `{z{…}}`, `{Z{…}}`) are now at least three characters wide, number inputs get one extra character so answers written differently from the solution still fit (e.g. `3.50` instead of `3.5`), and the hangman input is wider as well.
