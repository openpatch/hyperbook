import {
  redo,
  redoDepth,
  selectAll,
  undo,
  undoDepth,
} from "@codemirror/commands";
import { EditorSelection, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { toast } from "sonner";

/*
 * The editor's context menu, in place of the browser's: Cut, Copy, Paste,
 * Select All, Undo and Redo, in the looks of the spell checker's menu.
 * A right-click on a misspelled word keeps showing the spell checker's
 * suggestions instead: its handler (see spellcheck.ts) runs first, because
 * it comes first in the editor's extensions (see CodeEditor).
 */

/** Shortcut labels as the platform prints them. */
const mac = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = (letter: string) => (mac ? `⌘${letter}` : `Ctrl+${letter}`);

let menu: HTMLElement | null = null;
let menuCloser: (() => void) | null = null;

/** Closes the context menu, if one is open. */
export function closeMenu() {
  menuCloser?.();
  menuCloser = null;
  menu?.remove();
  menu = null;
}

/**
 * Opens a menu at the click. `build` fills it; its entries are made with
 * item() and separator(), so the spell checker's and the file tree's menus
 * look the same. Its styles are in app.css, for menus outside the editor too.
 */
export function openMenu(
  x: number,
  y: number,
  build: (box: HTMLElement) => void,
) {
  closeMenu();
  const box = document.createElement("div");
  box.className = "cm-context-menu";
  build(box);
  menu = box;
  document.body.append(box);
  // A mousedown anywhere else, or Escape, closes the menu again.
  const onDown = (event: MouseEvent) => {
    if (!box.contains(event.target as Node)) closeMenu();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") closeMenu();
  };
  document.addEventListener("mousedown", onDown, true);
  document.addEventListener("keydown", onKey, true);
  menuCloser = () => {
    document.removeEventListener("mousedown", onDown, true);
    document.removeEventListener("keydown", onKey, true);
  };
  // At the click, but never outside the window.
  const place = box.getBoundingClientRect();
  box.style.left = `${Math.max(4, Math.min(x, window.innerWidth - place.width - 8))}px`;
  box.style.top = `${Math.max(4, Math.min(y, window.innerHeight - place.height - 8))}px`;
}

/** One entry of a menu: what it does, and the key that does it too. */
export function item(
  box: HTMLElement,
  label: string,
  run: () => void,
  options: {
    shortcut?: string;
    disabled?: boolean;
    destructive?: boolean;
  } = {},
) {
  const button = document.createElement("button");
  button.type = "button";
  button.disabled = options.disabled === true;
  if (options.destructive) button.className = "cm-context-destructive";
  const text = document.createElement("span");
  text.textContent = label;
  button.append(text);
  if (options.shortcut) {
    const shortcut = document.createElement("span");
    shortcut.className = "cm-context-shortcut";
    shortcut.textContent = options.shortcut;
    button.append(shortcut);
  }
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (button.disabled) return;
    closeMenu();
    run();
  });
  box.append(button);
}

/** A line between the groups of a menu. */
export function separator(box: HTMLElement) {
  box.append(document.createElement("hr"));
}

/** Reads the clipboard's text, reporting when the browser keeps it away. */
async function paste(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    toast.error("The browser did not allow reading the clipboard.");
    return null;
  }
}

/**
 * Writes to the clipboard, reporting when the browser keeps it away.
 * Whether it worked, so Cut can keep the text when it did not.
 */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    toast.error("The browser did not allow writing the clipboard.");
    return false;
  }
}

/**
 * The editor's context menu (see the module comment): Cut, Copy and Paste for
 * the selection, Select All, and Undo and Redo.
 */
export function contextMenu(): Extension {
  return EditorView.domEventHandlers({
    mousedown: () => closeMenu(),
    scroll: () => closeMenu(),
    contextmenu(event, view) {
      event.preventDefault();
      // Like the browser's own menu: clicking outside the selection puts
      // the caret there, so Cut and Copy act on what was right-clicked.
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      const selection = view.state.selection;
      if (
        pos !== null &&
        !selection.ranges.some((range) => pos >= range.from && pos <= range.to)
      )
        view.dispatch({ selection: EditorSelection.cursor(pos) });
      const { from, to } = view.state.selection.main;
      const selected = from < to;
      const text = () => view.state.doc.sliceString(from, to);
      view.focus();
      openMenu(event.clientX, event.clientY, (box) => {
        item(
          box,
          "Undo",
          () => {
            view.focus();
            undo(view);
          },
          { shortcut: mod("Z"), disabled: undoDepth(view.state) === 0 },
        );
        item(
          box,
          "Redo",
          () => {
            view.focus();
            redo(view);
          },
          {
            shortcut: mac ? "⇧⌘Z" : "Ctrl+Y",
            disabled: redoDepth(view.state) === 0,
          },
        );
        separator(box);
        item(
          box,
          "Cut",
          () => {
            view.focus();
            void copy(text()).then((copied) => {
              if (copied) view.dispatch({ changes: { from, to, insert: "" } });
            });
          },
          { shortcut: mod("X"), disabled: !selected },
        );
        item(
          box,
          "Copy",
          () => {
            view.focus();
            void copy(text());
          },
          { shortcut: mod("C"), disabled: !selected },
        );
        item(
          box,
          "Paste",
          () => {
            view.focus();
            void paste().then((inserted) => {
              if (inserted === null || inserted === "") return;
              const { from: at, to } = view.state.selection.main;
              view.dispatch({ changes: { from: at, to, insert: inserted } });
            });
          },
          { shortcut: mod("V") },
        );
        separator(box);
        item(
          box,
          "Select all",
          () => {
            view.focus();
            selectAll(view);
          },
          { shortcut: mod("A") },
        );
      });
      return true;
    },
  });
}
