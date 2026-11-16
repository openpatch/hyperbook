import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { SQLite, sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import {
  typst_lezer,
  typstLezerFoldService,
  typstLezerIndentService,
  typstLezerListKeymap,
} from "codemirror-lang-typst/lezer";
import { LanguageSupport } from "@codemirror/language";
import { typstImportCompletion } from "./typst-imports";
import { revealInPdf, typstLint } from "./typst-preview";
import { editorPhrases } from "./codemirror-phrases";
import { indentWithTab } from "@codemirror/commands";
import { Compartment, type Extension, EditorState } from "@codemirror/state";
import i18next from "i18next";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { fontOf, type EditorSettings } from "@/lib/editor-settings";
import { type Block, editVisuallyButtons } from "./blocks";
import { contextMenu } from "./context-menu";
import { extension, isMarkdownPage } from "./files";
import { pageLanguage } from "./page-language";
import { type SpellConfig, spellCheck } from "./spellcheck";
import { hangingIndent } from "./hanging-indent";
import { hyperbookSyntax } from "./syntax-theme";
import { vimMode } from "./vim";
import { watchView } from "./outline";

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
    case "cjs":
      return javascript();
    case "jsx":
      return javascript({ jsx: true });
    case "ts":
      return javascript({ typescript: true });
    case "tsx":
      return javascript({ typescript: true, jsx: true });
    case "html":
    case "htm":
    case "xhtml":
    case "svg":
    case "xml":
      return html();
    case "yml":
    case "yaml":
      return yaml();
    case "py":
    case "pyw":
    case "pyi":
      return python();
    case "java":
      return java();
    case "scad":
      // OpenSCAD: the openscad directive's preview highlights it as C++ too.
      return cpp();
    case "sql":
      // The sqlide element runs SQLite, so its keywords highlight too.
      return sql({ dialect: SQLite });
    case "typ":
      return typstLanguage();
    default:
      return [];
  }
}

/**
 * Prose wraps at the window's edge: pages, snippets and templates in
 * Markdown, Typst and plain text. Code (Java, Python, HTML, CSS, …) keeps
 * its long lines, as in a code editor.
 */
function wrapsLines(path: string): boolean {
  if (isMarkdownPage(path)) return true;
  switch (extension(path)) {
    case "md":
    case "markdown":
    case "hbs":
    case "typ":
    case "txt":
      return true;
    default:
      return false;
  }
}

/**
 * Typst without the package's own colors: `typst_lezer()` brings the Typst
 * web app's light-theme style and CodeMirror's default one (underlined
 * headings, light-only colors), which would win over Hyperbook's syntax
 * theme, also in dark mode. Its parser, indentation, folding, list keys and
 * syntax checks are kept; the colors come from syntax-theme.ts.
 */
export function typstLanguage() {
  return new LanguageSupport(typst_lezer().language, [
    typstLezerIndentService,
    typstLezerListKeymap,
    typstLezerFoldService,
    // Its syntax checks run in typstLint, with the compiler's diagnostics.
  ]);
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
    borderRight: "1px solid var(--color-border)",
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
    border: "1px solid var(--color-border)",
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
  // The panels (search and replace) in the app's own look. CodeMirror's
  // defaults come scoped to its light or dark mode, which outranks a plain
  // `.cm-panels …` here: hence `&.cm-editor` in front of these.
  "&.cm-editor .cm-panels": {
    color: "var(--color-text)",
    backgroundColor: "var(--color-nav)",
    font: "13px var(--font-body, sans-serif)",
  },
  "&.cm-editor .cm-panels-top": { borderBottom: "1px solid var(--color-border)" },
  "&.cm-editor .cm-panels-bottom": { borderTop: "1px solid var(--color-border)" },
  // Its own rows (find, options, replace) stay; the controls only get room.
  "&.cm-editor .cm-panel.cm-search": { padding: "4px 32px 4px 8px" },
  "&.cm-editor .cm-panel.cm-search input, &.cm-editor .cm-panel.cm-search button, &.cm-editor .cm-panel.cm-search label":
    { margin: "3px 6px 3px 0", verticalAlign: "middle" },
  "&.cm-editor .cm-panels .cm-textfield": {
    font: "inherit",
    fontSize: "13px",
    height: "28px",
    padding: "0 8px",
    color: "var(--color-text)",
    backgroundColor: "var(--color-background)",
    border: "1px solid var(--color-border)",
    borderRadius: "6px",
    outline: "none",
  },
  "&.cm-editor .cm-panels .cm-textfield:focus-visible": {
    borderColor: "var(--color-brand)",
    boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-brand) 35%, transparent)",
  },
  "&.cm-editor .cm-panels .cm-textfield::placeholder": { color: "var(--muted-foreground)" },
  "&.cm-editor .cm-panels .cm-button": {
    font: "inherit",
    fontSize: "12px",
    height: "28px",
    padding: "0 10px",
    color: "var(--color-text)",
    backgroundColor: "var(--color-background)",
    backgroundImage: "none",
    border: "1px solid var(--color-border)",
    borderRadius: "6px",
    cursor: "pointer",
  },
  "&.cm-editor .cm-panels .cm-button:hover": {
    backgroundColor: "color-mix(in srgb, var(--color-brand) 12%, var(--color-background))",
  },
  "&.cm-editor .cm-panels .cm-button:active": {
    backgroundImage: "none",
    backgroundColor: "color-mix(in srgb, var(--color-brand) 22%, var(--color-background))",
  },
  "&.cm-editor .cm-panels .cm-button:focus-visible, &.cm-editor .cm-panels [name=close]:focus-visible": {
    outline: "2px solid var(--color-brand)",
    outlineOffset: "1px",
  },
  "&.cm-editor .cm-panel.cm-search label": {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    color: "var(--muted-foreground)",
    cursor: "pointer",
  },
  "&.cm-editor .cm-panel.cm-search input[type=checkbox]": {
    margin: 0,
    accentColor: "var(--color-brand)",
  },
  "&.cm-editor .cm-panel.cm-search [name=close]": {
    top: "6px",
    right: "6px",
    width: "22px",
    height: "22px",
    fontSize: "18px",
    lineHeight: "1",
    color: "var(--muted-foreground)",
    borderRadius: "4px",
    cursor: "pointer",
  },
  "&.cm-editor .cm-panel.cm-search [name=close]:hover": {
    color: "var(--color-text)",
    backgroundColor: "color-mix(in srgb, var(--color-text) 10%, transparent)",
  },
  // Matches of the search, the current one stronger; other occurrences of
  // the selected word fainter, in both modes.
  "&.cm-editor .cm-searchMatch": {
    backgroundColor: "color-mix(in srgb, #f59e0b 30%, transparent)",
    outline: "1px solid color-mix(in srgb, #f59e0b 55%, transparent)",
    borderRadius: "2px",
  },
  "&.cm-editor .cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "color-mix(in srgb, #f59e0b 60%, transparent)",
    outline: "1px solid #f59e0b",
  },
  "&.cm-editor .cm-selectionMatch": {
    backgroundColor: "color-mix(in srgb, var(--color-brand) 18%, transparent)",
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

/**
 * Hyperbook's own light/dark syntax themes (syntax-theme.ts), switched with
 * the app's theme, are the syntax base for every file: code files (Java,
 * Python, .scad, …) and Markdown pages alike (pages add only the Hyperbook
 * directive decorations on top). Being non-fallback styles, they also disable
 * basicSetup's defaultHighlightStyle, whose colors are light-only and
 * unreadable in dark mode. They carry no editor chrome, so the app's own
 * surfaces stay in charge.
 */
const codeTheme = new Compartment();
/** CodeMirror's own words in the app's language (see codemirror-phrases.ts). */
const phrasesCompartment = new Compartment();
const isDark = () => document.documentElement.classList.contains("dark");
// darkTheme tells CodeMirror's own defaults (panels, buttons, fields,
// matches) which of their light or dark variants apply.
const hyperbookTheme = () => [hyperbookSyntax(isDark()), EditorView.darkTheme.of(isDark())];

/** basicSetup always shows line numbers; without them, the whole gutter goes. */
const noGutters = EditorView.theme({ ".cm-gutters": { display: "none" } });
/** The base theme sets line-height on the scroller, so it needs a theme of its own. */
const lineHeightTheme = (height: number) =>
  EditorView.theme({ ".cm-scroller": { lineHeight: String(height) } });
/** The same for the font, on the scroller and the autocompletion's list. */
const fontTheme = (stack: string) =>
  EditorView.theme({
    ".cm-scroller": { fontFamily: stack },
    ".cm-tooltip.cm-tooltip-autocomplete > ul": { fontFamily: stack },
  });

/** Re-configured while editing, without rebuilding the editor. */
const numbersCompartment = new Compartment();
const heightCompartment = new Compartment();
const fontCompartment = new Compartment();
const spellCompartment = new Compartment();
const vimCompartment = new Compartment();

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
  readOnly = false,
  extensions = [],
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
  /** Commenters: the text can be read, selected and copied, not changed. */
  readOnly?: boolean;
  /** More extensions (comments), fixed for the editor's life. */
  extensions?: Extension;
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
    if (readOnly) return null;
    if (!current?.enabled || !isMarkdownPage(path)) return null;
    if (current.language !== "en" && current.language !== "de") return null;
    return {
      language: current.language,
      words: current.words,
      onAddWord: (word) => callbacks.current.spell?.onAddWord(word),
    };
  };

  /**
   * Vim, when chosen and the text can change. One instance per editor: the
   * same extension keeps Vim's mode and registers when another setting changes.
   */
  const vimExtension = useRef<Extension | null>(null);
  const vimFor = (on: boolean): Extension =>
    on && !readOnly
      ? (vimExtension.current ??= vimMode(() => callbacks.current.onSave()))
      : [];

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initial,
        extensions: [
          // Before every keymap, so Vim sees the keys first.
          vimCompartment.of(vimFor(settings.vim)),
          keymap.of([
            // basicSetup binds no Tab key; without this, Tab moves the focus
            // out of the editor instead of indenting.
            indentWithTab,
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
          codeTheme.of(hyperbookTheme()),
          phrasesCompartment.of(editorPhrases()),
          numbersCompartment.of(settings.lineNumbers ? [] : noGutters),
          heightCompartment.of(lineHeightTheme(settings.lineHeight)),
          fontCompartment.of(fontTheme(fontOf(settings.font).stack)),
          // The spell check's menu comes first: a right-click on a misspelled
          // word shows its corrections, everywhere else the editor's menu.
          spellCompartment.of(spellConfig() ? spellCheck(spellConfig()!) : []),
          contextMenu({ readOnly }),
          readOnly ? [EditorState.readOnly.of(true)] : [],
          // Wrapped lines continue under their own indentation.
          wrapsLines(path)
            ? [
                EditorView.lineWrapping,
                hangingIndent({ markdown: isMarkdownPage(path) || extension(path) === "hbs" }),
              ]
            : [],
          // Typst's errors from the PDF preview (typst-preview.tsx).
          extension(path) === "typ"
            ? [
                typstLint,
                typstImportCompletion,
                // From the cursor to its line in the PDF preview.
                keymap.of([
                  {
                    key: "Alt-Enter",
                    preventDefault: true,
                    run: (v) => {
                      void revealInPdf(pathRef.current, v.state.doc.toString(), v.state.selection.main.head);
                      return true;
                    },
                  },
                ]),
              ]
            : [],
          // Its name for screen readers: which file is being edited.
          EditorView.contentAttributes.of({
            "aria-label": i18next.t("editor.tabs.contents", { path }),
          }),
          // Pages and snippets: Markdown with Hyperbook's directives. A
          // .md.hbs page works as a template, but is written as Markdown too.
          isMarkdownPage(path) || extension(path) === "hbs"
            ? pageLanguage({
                files: () => callbacks.current.files,
                path: () => pathRef.current,
                onPageSettings:
                  isMarkdownPage(path) && onPageSettings && !readOnly
                    ? (v) => callbacks.current.onPageSettings?.(v)
                    : undefined,
              })
            : language(path),
          isMarkdownPage(path) && !readOnly
            ? editVisuallyButtons((block, v) =>
                callbacks.current.onEditBlock?.(block, v),
              )
            : [],
          theme,
          extensions,
          // The outline follows the text and the cursor.
          watchView,
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              callbacks.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    onReady?.(v);
    // The light/dark toggle moves the .dark class on <html>, a new language
    // its lang attribute (see i18n.tsx); follow both.
    const observer = new MutationObserver(() => {
      v.dispatch({
        effects: [codeTheme.reconfigure(hyperbookTheme()), phrasesCompartment.reconfigure(editorPhrases())],
      });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "lang"] });
    return () => {
      observer.disconnect();
      onReady?.(null);
      v.destroy();
    };
    // A new file or a reload gets a new view (the parent changes the key).
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The settings apply while editing, without rebuilding the editor.
  const { lineNumbers, lineHeight, font, vim } = settings;
  const { enabled, language: spellLanguage, words } = spell ?? {};
  useEffect(() => {
    const config = spellConfig();
    view.current?.dispatch({
      effects: [
        numbersCompartment.reconfigure(lineNumbers ? [] : noGutters),
        heightCompartment.reconfigure(lineHeightTheme(lineHeight)),
        fontCompartment.reconfigure(fontTheme(fontOf(font).stack)),
        spellCompartment.reconfigure(config ? spellCheck(config) : []),
        vimCompartment.reconfigure(vimFor(vim)),
      ],
    });
    // Another font means other character widths, so the editor re-measures.
    view.current?.requestMeasure();
  }, [lineNumbers, lineHeight, font, vim, enabled, spellLanguage, words, path]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={host}
      className="h-full min-h-0 overflow-hidden"
      style={{ fontSize: `${settings.fontSize}px` }}
      data-path={path}
    />
  );
}
