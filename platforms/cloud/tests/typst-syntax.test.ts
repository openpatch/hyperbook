import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { HighlightStyle, ensureSyntaxTree, highlightingFor } from "@codemirror/language";
import { highlightTree } from "@lezer/highlight";
import { hyperbookDark, hyperbookLight } from "../src/web/pages/editor/syntax-theme";

const DOC = '#import "@preview/cetz:0.3.0": *\n= Test\nDas ist _ein_ super. $x^2$\n- Punkt\n';

describe("Typst in the editor", async () => {
  // code-editor.tsx needs a DOM for its imports; the language alone does not.
  const { typstLanguage } = await import("../src/web/pages/editor/code-editor").catch(() => ({ typstLanguage: null }));

  const styled = (style: HighlightStyle) => {
    const state = EditorState.create({ doc: DOC, extensions: [typstLanguage!()] });
    const tree = ensureSyntaxTree(state, state.doc.length, 5000)!;
    const spans: [string, string][] = [];
    highlightTree(tree, style, (from, to, classes) => spans.push([DOC.slice(from, to), classes]));
    return { state, spans };
  };

  it.skipIf(!typstLanguage).each([
    ["dark", hyperbookDark],
    ["light", hyperbookLight],
  ])("colors Typst with Hyperbook's %s theme only", (_, style) => {
    const { state, spans } = styled(style);
    const classOf = (text: string) => spans.find(([t]) => t === text)?.[1];
    const css = style.module!.getRules();
    const colorOf = (text: string) => {
      const cls = classOf(text);
      if (!cls) return undefined;
      return new RegExp(`\\.${cls}\\s*\\{[^}]*color:\\s*(#[0-9a-f]{6})`, "i").exec(css)?.[1];
    };
    // `#` and `import` read as one keyword.
    expect(colorOf("#")).toBeDefined();
    expect(colorOf("#")).toBe(colorOf("import"));
    expect(classOf('"@preview/cetz:0.3.0"')).toBeDefined();
    expect(spans.some(([t]) => t.startsWith("= Test") || t === "Test")).toBe(true);
    expect(classOf("-")).toBeDefined();
    // No style of the grammar package is active, only the editor's own.
    expect(highlightingFor(state, [])).toBeNull();
  });
});
