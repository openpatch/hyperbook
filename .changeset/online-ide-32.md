---
"@hyperbook/markdown": patch
"hyperbook": patch
---

Update the embedded Online IDE to v2.2.1-hyperbook.32. Shader assets (`.frag`,
`.vert`, and `.glsl`) now open as editable source with GLSL highlighting.
Shader edits survive browser reloads and are used on the next run instead of
reusing an older cached shader.
