---
"@hyperbook/markdown": minor
"hyperbook": minor
---

Improve the OpenSCAD directive with a non-blocking worker-based renderer and better color-aware outputs.

- Move OpenSCAD rendering and parameter extraction to a Web Worker to keep the page responsive.
- Align worker responses with an `OpenSCADInvocationResults`-style payload (`exitCode`, `error`, `outputs`, `mergedOutputs`, `elapsedMillis`).
- Use OFF-based preview rendering with improved face-color parsing and material grouping.
- Add STL/3MF download format selection in the OpenSCAD UI.
- Add automatic 3MF generation from the indexed polyhedron, including base materials and paint-color mapping.
