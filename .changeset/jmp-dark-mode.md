---
"@hyperbook/markdown": patch
"@hyperbook/cloud": patch
---

The java-memory-playground directive now follows the book's dark theme instead of staying light: `dark.css` sets `color-scheme: dark` on `.directive-jmp` and maps the playground's raised surfaces (`--jmp-surface-sunken`, `--jmp-panel`) to the book's author background, the same mapping bitflow gets, and the fullscreen/reset buttons and fullscreen backdrop in `directive-jmp/style.css` use the book's colour tokens with the old light values as fallbacks, so they stay visible in dark books. The floor for `@java-memory-playground/web-component` is raised to `^0.3.5`, whose own tokens provide the dark values; the cloud editor's pin of `@java-memory-playground/java-memory-playground` follows to `0.2.6`, the core version books render with.
