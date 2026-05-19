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
    view.dispatch({ effects: themeComp.reconfigure(dark ? githubDark : githubLight) });
  }
}

document.addEventListener("colorschemechange", (e) => {
  applyTheme(e.detail.colorScheme === "dark");
});

/**
 * Create a CodeMirror 6 editor inside container.
 *
 * @param {HTMLElement} container
 * @param {{lang?: string, value?: string, readOnly?: boolean, onChange?: (code: string) => void}} opts
 * @returns {{ getValue(): string, setValue(v: string): void, setReadOnly(ro: boolean): void, destroy(): void }}
 */
function create(container, { lang = "", value = "", readOnly = false, onChange } = {}) {
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
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    },
    setReadOnly(ro) {
      view.dispatch({ effects: readOnlyComp.reconfigure(EditorState.readOnly.of(ro)) });
    },
    destroy() {
      activeViews.delete(entry);
      view.destroy();
    },
  };
}

window.HyperbookCM = { create };
