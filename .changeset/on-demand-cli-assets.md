---
"hyperbook": minor
"@hyperbook/markdown": minor
---

Download Blockflow, Online IDE, SQL IDE, Excalidraw, OpenSCAD, GeoGebra, Pyodide and Typst assets when a build first uses them instead of including them in the CLI package. Cache verified bundles across builds, support `hyperbook assets fetch` and `hyperbook assets fetch --all` for prefetching, and add `--offline` to build and dev.

Serve GeoGebra's Math Apps bundle, Pyodide's runtime and vendored packages, Typst's compiler, renderer and standard fonts, and OpenSCAD's optional libraries and font locally in exported books. Kiri:Moto, external media and materials, arbitrary PyPI packages, and Typst preview packages still use their external services.

Update Pyodide to 314.0.7 (Python 3.14), Typst browser packages to 0.7.0, and OpenSCAD to the 2026.10.08 WebAssembly snapshot. Adapt cancelled turtle numeric input to Pyodide’s current JavaScript-to-Python conversions.
