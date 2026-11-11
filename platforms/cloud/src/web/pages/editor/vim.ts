import { Vim, vim } from "@replit/codemirror-vim";
import { type Extension, Facet, Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

/** What `:w` does in an editor: save its file. */
const saveFacet = Facet.define<() => void>();

let commandsDefined = false;

/** `:w` (and `:wa`, `:x`, `:wq`, which cannot close a tab here) save the file. */
function defineCommands() {
  if (commandsDefined) return;
  commandsDefined = true;
  const save = (cm: { cm6: EditorView }) => {
    for (const run of cm.cm6.state.facet(saveFacet)) run();
  };
  Vim.defineEx("write", "w", save);
  Vim.defineEx("wall", "wa", save);
  Vim.defineEx("xit", "x", save);
  Vim.defineEx("wq", "wq", save);
}

/** The fat cursor and the status line in Hyperbook's colors, light and dark. */
const vimTheme = Prec.highest(
  EditorView.theme({
    ".cm-fat-cursor": {
      background: "color-mix(in srgb, var(--color-brand) 55%, transparent)",
      color: "var(--color-text)",
    },
    "&:not(.cm-focused) .cm-fat-cursor": {
      background: "none",
      outline: "solid 1px var(--color-brand)",
    },
    ".cm-vim-panel": {
      fontFamily: "var(--font-code, ui-monospace, monospace)",
      color: "var(--color-text)",
    },
  }),
);

/**
 * Vim key bindings, with the mode in a status line under the text. They go
 * first among the editor's extensions, so Vim sees the keys before the
 * editor's own keymaps.
 */
export function vimMode(onSave: () => void): Extension {
  defineCommands();
  return [vim({ status: true }), saveFacet.of(onSave), vimTheme];
}
