---
"@hyperbook/markdown": patch
---

`keepaspectratio` on `:::jsxgraph` now works. The element read a misspelled attribute (`keepaspetcratio`) and passed it to JSXGraph under a misspelled name, so the option never had an effect. The old spelling still works but warns.
