---
"@hyperbook/markdown": patch
"hyperbook": patch
---

**pyide**: Remove pytamaro canvas-mode rendering. `show_graphic()` and `show_animation()` now always render to the output panel, which correctly displays animated GIFs produced by `show_animation()`. The `canvas` attribute on `:::pyide` is no longer needed for pytamaro and has no effect on pytamaro output.
