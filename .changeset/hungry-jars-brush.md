---
"@hyperbook/markdown": patch
"hyperbook": patch
"hyperbook-studio": patch
---

Update the dependencies.

Nothing changes in what a hyperbook renders. Two things about the output are
worth knowing anyway:

- Attributes that hold a list of words, `rel` and the `sandbox` of an embedded
  IDE, are built as the lists they are. They are written to the page exactly as
  before.
- pako 3 packs the same bytes differently, so the address a blockflow editor is
  embedded under changes on the next build. It carries the same project.
