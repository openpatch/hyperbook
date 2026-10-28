import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { type Extension, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { type Block, editVisuallyButtons } from "./blocks";
import { extension } from "./files";

function language(path: string): Extension {
  switch (extension(path)) {
    case "md":
    case "hbs":
      return markdown();
    case "json":
    case "bitflow":
    case "struktolab":
    case "learningmap":
    case "excalidraw":
    case "jmp":
      return json();
    case "css":
      return css();
    case "js":
    case "mjs":
      return javascript();
    case "ts":
      return javascript({ typescript: true });
    case "html":
    case "svg":
    case "xml":
      return html();
    case "yml":
    case "yaml":
      return yaml();
    default:
      return [];
  }
}

/** Colors from Hyperbook's tokens, so the editor follows light and dark mode. */
const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "14px", color: "var(--color-text)", backgroundColor: "var(--color-background)" },
  ".cm-scroller": { fontFamily: "var(--font-code, ui-monospace, monospace)" },
  ".cm-content": { caretColor: "var(--color-brand)" },
  ".cm-gutters": {
    backgroundColor: "var(--color-nav)",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--color-nav-border)",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--color-brand) 6%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--color-brand) 12%, transparent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "color-mix(in srgb, var(--color-brand) 25%, transparent) !important",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-edit-visually": {
    marginLeft: "12px",
    padding: "0 8px",
    font: "12px var(--font-body, sans-serif)",
    color: "var(--color-brand)",
    background: "transparent",
    border: "1px solid var(--color-brand)",
    borderRadius: "4px",
    cursor: "pointer",
  },
});

/**
 * One CodeMirror view per open file; switching tabs keeps each file's undo
 * history and cursor because the parent keeps the views mounted by key.
 */
export function CodeEditor({
  path,
  initial,
  onChange,
  onSave,
  onEditBlock,
  onReady,
}: {
  path: string;
  initial: string;
  onChange: (text: string) => void;
  onSave: () => void;
  /** Pages: open an element block (e.g. a structogram) in its visual editor. */
  onEditBlock?: (block: Block, view: EditorView) => void;
  /** Hands out the view, e.g. to insert text at the cursor. */
  onReady?: (view: EditorView | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The latest callbacks, without rebuilding the editor when they change.
  const callbacks = useRef({ onChange, onSave, onEditBlock });
  callbacks.current = { onChange, onSave, onEditBlock };

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initial,
        extensions: [
          keymap.of([
            {
              key: "Mod-s",
              preventDefault: true,
              run: () => {
                callbacks.current.onSave();
                return true;
              },
            },
          ]),
          basicSetup,
          EditorView.lineWrapping,
          language(path),
          extension(path) === "md" ? editVisuallyButtons((block, v) => callbacks.current.onEditBlock?.(block, v)) : [],
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    onReady?.(v);
    return () => {
      onReady?.(null);
      v.destroy();
    };
    // A new file or a reload gets a new view (the parent changes the key).
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} className="h-full min-h-0 overflow-hidden" data-path={path} />;
}
