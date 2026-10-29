import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { Compartment, type Extension, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import type { EditorSettings } from "@/lib/editor-settings";
import { type Block, editVisuallyButtons } from "./blocks";
import { contextMenu } from "./context-menu";
import { extension } from "./files";
import { pageLanguage } from "./page-language";
import { type SpellConfig, spellCheck } from "./spellcheck";

function language(path: string): Extension {
  switch (extension(path)) {
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
  // The font size comes from the host element (see CodeEditor).
  "&": {
    height: "100%",
    color: "var(--color-text)",
    backgroundColor: "var(--color-background)",
  },
  ".cm-scroller": { fontFamily: "var(--font-code, ui-monospace, monospace)" },
  ".cm-content": { caretColor: "var(--color-brand)" },
  // basicSetup draws its own cursor (drawSelection), so caretColor alone does not reach it.
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--color-brand)",
    borderLeftWidth: "2px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--color-nav)",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--color-nav-border)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--color-brand) 6%, transparent)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--color-brand) 12%, transparent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection":
    {
      backgroundColor:
        "color-mix(in srgb, var(--color-brand) 25%, transparent) !important",
    },
  "&.cm-focused": { outline: "none" },
  ".cm-tooltip": {
    color: "var(--color-text)",
    backgroundColor: "var(--color-background)",
    border: "1px solid var(--color-nav-border)",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgb(0 0 0 / 0.2)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    fontFamily: "var(--font-code, ui-monospace, monospace)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    color: "var(--color-text)",
    backgroundColor: "color-mix(in srgb, var(--color-brand) 25%, transparent)",
  },
  ".cm-completionDetail": { color: "var(--muted-foreground)" },
  ".cm-completionMatchedText": {
    color: "var(--color-brand)",
    textDecoration: "none",
    fontWeight: "bold",
  },
  ".cm-diagnostic": { color: "var(--color-text)" },
  ".cm-panels": {
    color: "var(--color-text)",
    backgroundColor: "var(--color-nav)",
  },
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

/** basicSetup always shows line numbers; without them, the whole gutter goes. */
const noGutters = EditorView.theme({ ".cm-gutters": { display: "none" } });

/** Re-configured while editing, without rebuilding the editor. */
const numbersCompartment = new Compartment();
const spellCompartment = new Compartment();

export type SpellOptions = {
  enabled: boolean;
  language: string;
  words: ReadonlySet<string>;
  onAddWord: (word: string) => void;
};

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
  onPageSettings,
  files = [],
  onReady,
  settings,
  spell,
}: {
  path: string;
  initial: string;
  onChange: (text: string) => void;
  onSave: () => void;
  /** Pages: open an element block (e.g. a structogram) in its visual editor. */
  onEditBlock?: (block: Block, view: EditorView) => void;
  /** Pages: edit the frontmatter as a form. */
  onPageSettings?: (view: EditorView) => void;
  /** The book's files, offered for links and `src`. */
  files?: string[];
  /** Hands out the view, e.g. to insert text at the cursor. */
  onReady?: (view: EditorView | null) => void;
  /** The teacher's editor settings (see lib/editor-settings.ts). */
  settings: EditorSettings;
  /** Spell check for pages; `words` must stay one Set until it changes. */
  spell?: SpellOptions;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The latest callbacks, without rebuilding the editor when they change.
  /** The file's path: a rename keeps the editor. */
  const pathRef = useRef(path);
  pathRef.current = path;
  const callbacks = useRef({
    onChange,
    onSave,
    onEditBlock,
    onPageSettings,
    files,
    spell,
  });
  callbacks.current = {
    onChange,
    onSave,
    onEditBlock,
    onPageSettings,
    files,
    spell,
  };

  /** Spell check for this file, with a dictionary we have; null switches it off. */
  const spellConfig = (): SpellConfig | null => {
    const current = callbacks.current.spell;
    if (!current?.enabled || extension(path) !== "md") return null;
    if (current.language !== "en" && current.language !== "de") return null;
    return {
      language: current.language,
      words: current.words,
      onAddWord: (word) => callbacks.current.spell?.onAddWord(word),
    };
  };

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
          numbersCompartment.of(settings.lineNumbers ? [] : noGutters),
          // The spell check's menu comes first: a right-click on a misspelled
          // word shows its corrections, everywhere else the editor's menu.
          spellCompartment.of(spellConfig() ? spellCheck(spellConfig()!) : []),
          contextMenu(),
          EditorView.lineWrapping,
          // Pages and snippets: Markdown with Hyperbook's directives.
          extension(path) === "md" || extension(path) === "hbs"
            ? pageLanguage({
                files: () => callbacks.current.files,
                path: () => pathRef.current,
                onPageSettings:
                  extension(path) === "md" && onPageSettings
                    ? (v) => callbacks.current.onPageSettings?.(v)
                    : undefined,
              })
            : language(path),
          extension(path) === "md"
            ? editVisuallyButtons((block, v) =>
                callbacks.current.onEditBlock?.(block, v),
              )
            : [],
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              callbacks.current.onChange(update.state.doc.toString());
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

  // The settings apply while editing, without rebuilding the editor.
  const { lineNumbers } = settings;
  const { enabled, language: spellLanguage, words } = spell ?? {};
  useEffect(() => {
    const config = spellConfig();
    view.current?.dispatch({
      effects: [
        numbersCompartment.reconfigure(lineNumbers ? [] : noGutters),
        spellCompartment.reconfigure(config ? spellCheck(config) : []),
      ],
    });
  }, [lineNumbers, enabled, spellLanguage, words, path]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={host}
      className="h-full min-h-0 overflow-hidden"
      style={{ fontSize: `${settings.fontSize}px` }}
      data-path={path}
    />
  );
}
