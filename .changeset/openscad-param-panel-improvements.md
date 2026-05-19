---
"hyperbook": minor
"@hyperbook/markdown": minor
---

Migrate all code editors to CodeMirror 6 and improve OpenSCAD parameter panel

**CodeMirror 6 migration**

- Replace `@webcoder49/code-input` (Prism.js) with CodeMirror 6 across all interactive elements: `webide`, `pyide`, `p5`, `typst`, and `abc-music`.
- Editors now feature syntax highlighting via CodeMirror language packages (HTML, CSS, JavaScript, Python, C++), GitHub Light/Dark themes, and proper bracket/indent handling.

**OpenSCAD parameter panel**

- Always show the parameters panel (no longer hidden when no parameters exist).
- Support `/* [Tab Name] */` comment syntax to group parameters into collapsible accordions. Parameters in `/* [Global] */` are shown outside any accordion.
- Accordion open/closed state is preserved across parameter rebuilds.
- Parameter changes now auto-trigger a re-render of the preview.
- Parameter changes are written back into the editor source code so the code stays in sync.
- Editing the source code directly also triggers a re-render.
