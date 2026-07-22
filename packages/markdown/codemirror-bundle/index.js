/**
 * CodeMirror 6 browser bundle for Hyperbook IDEs.
 * Exposes window.HyperbookCM = { create } for use in directive client.js files.
 *
 * Languages bundled: cpp (clike/OpenSCAD), javascript, python, html, css.
 * Any unrecognised lang falls back to plain-text mode.
 * Dark theme (oneDark) is applied automatically based on the dark-mode-toggle element,
 * and updates on the `colorschemechange` event (same pattern as the mermaid directive).
 */
import { EditorView, basicSetup } from "codemirror";
import { keymap } from "@codemirror/view";
import { Compartment, EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { githubDark } from "@fsegurai/codemirror-theme-github-dark";
import { githubLight } from "@fsegurai/codemirror-theme-github-light";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";

const langExtMap = {
  javascript,
  python,
  cpp,
  clike: cpp,
  html,
  css,
};

/** All active views, so we can update their theme compartment on scheme change. */
const activeViews = new Set();

function isDark() {
  return document.querySelector("dark-mode-toggle")?.mode === "dark";
}

function applyTheme(dark) {
  for (const { view, themeComp } of activeViews) {
    view.dispatch({
      effects: themeComp.reconfigure(dark ? githubDark : githubLight),
    });
  }
}

document.addEventListener("colorschemechange", (e) => {
  applyTheme(e.detail.colorScheme === "dark");
});

/**
 * A library-specific completion set, supplied as plain data by a directive so
 * that no directive needs to depend on CodeMirror itself.
 *
 * @typedef {object} CompletionSpec
 * @property {(doc: string) => boolean} [enabled]
 *   Gate on the document's contents, e.g. only when the library is imported.
 * @property {import("@codemirror/autocomplete").Completion[]} [globals]
 *   Offered while typing a bare identifier.
 * @property {import("@codemirror/autocomplete").Completion[]} [members]
 *   Offered after `<base>.`, for the bases reported by memberBases.
 * @property {(doc: string) => string[]} [memberBases]
 *   Identifiers in the document that expose `members`.
 */

/** Completions are noise inside comments and string literals. */
function inCommentOrString(context) {
  const node = syntaxTree(context.state).resolveInner(context.pos, -1);
  for (let cur = node; cur; cur = cur.parent) {
    if (/Comment|String/.test(cur.name)) return true;
  }
  return false;
}

/**
 * Turn a CompletionSpec into a CodeMirror completion source.
 * @param {CompletionSpec} spec
 */
function completionSource(spec) {
  return (context) => {
    const doc = context.state.doc.toString();
    if (spec.enabled && !spec.enabled(doc)) return null;
    if (inCommentOrString(context)) return null;

    // `<base>.<partial>` — only complete members of a known base.
    const dotted = context.matchBefore(/\.\w*$/);
    if (dotted) {
      if (!spec.members?.length) return null;
      const before = context.state.sliceDoc(
        Math.max(0, dotted.from - 64),
        dotted.from,
      );
      const base = /([A-Za-z_]\w*)\s*$/.exec(before)?.[1];
      if (!base) return null;
      const bases = spec.memberBases ? spec.memberBases(doc) : [];
      if (!bases.includes(base)) return null;
      return {
        from: dotted.from + 1,
        options: spec.members,
        validFor: /^\w*$/,
      };
    }

    if (!spec.globals?.length) return null;
    const word = context.matchBefore(/\w*$/);
    if (!word || (word.from === word.to && !context.explicit)) return null;
    // A dotted expression whose base is unknown must not fall back to globals.
    if (
      word.from > 0 &&
      context.state.sliceDoc(word.from - 1, word.from) === "."
    ) {
      return null;
    }
    return { from: word.from, options: spec.globals, validFor: /^\w*$/ };
  };
}

/**
 * Create a CodeMirror 6 editor inside container.
 *
 * @param {HTMLElement} container
 * @param {{lang?: string, value?: string, readOnly?: boolean, onChange?: (code: string) => void, completions?: CompletionSpec[]}} opts
 * @returns {{ getValue(): string, setValue(v: string): void, setReadOnly(ro: boolean): void, destroy(): void }}
 */
function create(
  container,
  { lang = "", value = "", readOnly = false, onChange, completions } = {},
) {
  const readOnlyComp = new Compartment();
  const themeComp = new Compartment();

  const extensions = [
    basicSetup,
    keymap.of([indentWithTab]),
    EditorView.theme({
      "&": { height: "100%" },
      ".cm-scroller": { overflow: "auto" },
    }),
    themeComp.of(isDark() ? githubDark : githubLight),
    readOnlyComp.of(EditorState.readOnly.of(readOnly)),
  ];

  const langFn = langExtMap[lang];
  if (langFn) extensions.push(langFn());

  if (completions?.length) {
    // basicSetup already enables autocompletion, so these are registered as
    // extra language-data sources rather than replacing the language's own.
    const sources = completions.map((spec) => ({
      autocomplete: completionSource(spec),
    }));
    extensions.push(EditorState.languageData.of(() => sources));
  }

  if (onChange) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChange(update.state.doc.toString());
      }),
    );
  }

  const view = new EditorView({ doc: value, extensions, parent: container });
  const entry = { view, themeComp };
  activeViews.add(entry);

  return {
    getValue() {
      return view.state.doc.toString();
    },
    setValue(v) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: v },
      });
    },
    setReadOnly(ro) {
      view.dispatch({
        effects: readOnlyComp.reconfigure(EditorState.readOnly.of(ro)),
      });
    },
    destroy() {
      activeViews.delete(entry);
      view.destroy();
    },
  };
}

window.HyperbookCM = { create };
