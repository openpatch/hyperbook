import { defineEditorElement } from "@bitflow/web-component/editor";
import { useEffect, useRef } from "react";
import type { VisualEditorProps } from "./protocol";

defineEditorElement();

const serialize = (flow: unknown) => JSON.stringify(flow, null, 2) + "\n";

type FlowEvent = CustomEvent<{ flow: unknown }>;

/**
 * bitflow's own authoring element, of the version books render with. It
 * reports each edit (`bitflow-edit`); its save button (`bitflow-save`)
 * saves the file.
 */
export default function BitflowEditor({ text, language, onChange, onSave }: VisualEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onChange, onSave });
  callbacks.current = { onChange, onSave };

  useEffect(() => {
    const editor = document.createElement("bitflow-flow-editor") as HTMLElement & { flow?: unknown; locale?: string };
    if (text.trim()) editor.flow = text;
    editor.locale = language;
    editor.style.display = "block";
    editor.style.height = "100%";
    editor.addEventListener("bitflow-edit", (e) => callbacks.current.onChange(serialize((e as FlowEvent).detail.flow)));
    editor.addEventListener("bitflow-save", (e) => {
      callbacks.current.onChange(serialize((e as FlowEvent).detail.flow));
      callbacks.current.onSave();
    });
    host.current!.append(editor);
    return () => editor.remove();
  }, [text, language]);

  return <div ref={host} style={{ height: "100%" }} />;
}
