import { type StruktolabEditor, treeToPseudocode } from "struktolab/editor";
import { useEffect, useRef } from "react";
import type { VisualEditorProps } from "./protocol";
import { embed } from "./struktolab-embed";

/**
 * struktolab's editor of the version books render with. The document is the
 * pseudocode of a `:::struktolab` block; `language` picks its keywords
 * (de: "falls", en: "if"), so it is the book's language, not the UI's.
 */
export default function StruktolabPseudocodeEditor({ text, language, onChange }: VisualEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    const editor = document.createElement("struktolab-editor") as StruktolabEditor;
    editor.setAttribute("lang", language);
    editor.setAttribute("font-size", "14");
    embed(editor, "structogram");
    const code = document.createElement("script");
    code.type = "text/pseudocode";
    code.textContent = text;
    editor.append(code);
    // The block as struktolab writes it, before any edit: it reports the
    // parsed block once while starting, and normalizes indentation.
    let baseline: string | null = null;
    editor.addEventListener("change", (e) => {
      const now = treeToPseudocode((e as CustomEvent<{ tree: unknown }>).detail.tree, editor.keywords);
      if (baseline === null) {
        baseline = now;
        return;
      }
      latest.current(now === baseline ? text : now);
    });
    host.current!.append(editor);
    if (baseline === null && editor.tree) baseline = treeToPseudocode(editor.tree, editor.keywords);
    return () => editor.remove();
  }, [text, language]);

  return <div ref={host} style={{ height: "100%", overflow: "auto", padding: 8, boxSizing: "border-box" }} />;
}
