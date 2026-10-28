import { type StruktolabEditor, stripInsertNodes } from "struktolab/editor";
import { useEffect, useRef } from "react";
import type { VisualEditorProps } from "./protocol";
import { embed } from "./struktolab-embed";

const serialize = (tree: unknown) => JSON.stringify(stripInsertNodes(tree), null, 2) + "\n";

/**
 * A `.struktolab` file in struktolab's editor, of the version books render
 * with. The file is the structogram's tree as JSON (the editor's
 * `saveJSON()`), which `::struktolab{src=…}` loads as it is. `language`
 * picks the keywords the pseudocode view shows, so it is the book's.
 */
export default function StruktolabFileEditor({ text, language, onChange }: VisualEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(onChange);
  latest.current = onChange;

  useEffect(() => {
    const editor = document.createElement("struktolab-editor") as StruktolabEditor;
    editor.setAttribute("lang", language);
    editor.setAttribute("font-size", "14");
    embed(editor, "structogram");
    // The file as struktolab writes it, before any edit: loading reports
    // the tree once, and normalizes it.
    let baseline: string | null = null;
    editor.addEventListener("change", (e) => {
      const now = serialize((e as CustomEvent<{ tree: unknown }>).detail.tree);
      if (baseline === null) {
        baseline = now;
        return;
      }
      latest.current(now === baseline ? text : now);
    });
    host.current!.append(editor);
    if (text.trim()) editor.loadJSON(text);
    else baseline = "";
    return () => editor.remove();
  }, [text, language]);

  return <div ref={host} style={{ height: "100%", overflow: "auto", padding: 8, boxSizing: "border-box" }} />;
}
