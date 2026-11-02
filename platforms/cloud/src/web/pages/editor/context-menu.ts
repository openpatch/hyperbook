import {
  redo,
  redoDepth,
  selectAll,
  undo,
  undoDepth,
} from "@codemirror/commands";
import { EditorSelection, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import i18next from "i18next";
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
/** What had the focus before the menu took it. */
let returnFocus: HTMLElement | null = null;

/**
 * Closes the context menu, if one is open. `restore` gives the focus back to
 * where it was before the menu opened: after a choice or Escape, but not
 * after a click elsewhere, which puts the focus there itself.
 */
export function closeMenu(restore = false) {
  menuCloser?.();
  menuCloser = null;
  const hadFocus = menu?.contains(document.activeElement) ?? false;
  menu?.remove();
  menu = null;
  if (restore && hadFocus) returnFocus?.focus({ preventScroll: true });
  returnFocus = null;
}

/**
 * Whether the menu key or Shift+F10 asked for the menu, not the mouse: the
 * browser then raises `contextmenu` on the focused element without a button
 * (Chromium: -1), as a pointer event without a pointer, or at no place on
 * the screen.
 */
export function fromKeyboard(event: MouseEvent): boolean {
  return (
    event.button === -1 ||
    ("pointerType" in event && (event as PointerEvent).pointerType === "") ||
    (event.clientX === 0 && event.clientY === 0)
  );
}

/** Where a `contextmenu` event's menu goes: at the click, or below the focused element. */
export function menuPoint(event: MouseEvent): { x: number; y: number } {
  if (fromKeyboard(event) && event.target instanceof Element) {
    const rect = event.target.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom };
  }
  return { x: event.clientX, y: event.clientY };
}

/** The entries one can choose, in order. */
function choices(box: HTMLElement): HTMLButtonElement[] {
  return [...box.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
}

/**
 * Opens a menu at the click. `build` fills it; its entries are made with
 * item() and separator(), so the spell checker's and the file tree's menus
 * look the same. Its styles are in app.css, for menus outside the editor too.
 *
 * It works from the keyboard like the browser's own: the arrow keys, Home and
 * End move between the entries, Enter or Space chooses one, Escape or Tab
 * closes it, and the focus goes back to where it was. Opened from the
 * keyboard (`focusFirst`), the first entry has the focus at once.
 */
export function openMenu(
  x: number,
  y: number,
  build: (box: HTMLElement) => void,
  { focusFirst = false }: { focusFirst?: boolean } = {},
) {
  closeMenu();
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const box = document.createElement("div");
  box.className = "cm-context-menu";
  box.setAttribute("role", "menu");
  box.tabIndex = -1;
  build(box);
  menu = box;
  document.body.append(box);
  // A press anywhere else, mouse or touch, Escape or Tab closes the menu again.
  const onDown = (event: PointerEvent) => {
    if (!box.contains(event.target as Node)) closeMenu();
  };
  const onKey = (event: KeyboardEvent) => {
    const entries = choices(box);
    const at = entries.indexOf(document.activeElement as HTMLButtonElement);
    let next: HTMLButtonElement | undefined;
    switch (event.key) {
      case "Escape":
      case "Tab":
        event.preventDefault();
        event.stopPropagation();
        closeMenu(true);
        return;
      case "ArrowDown":
        next = entries[at < 0 ? 0 : (at + 1) % entries.length];
        break;
      case "ArrowUp":
        next = entries[at < 0 ? entries.length - 1 : (at - 1 + entries.length) % entries.length];
        break;
      case "Home":
        next = entries[0];
        break;
      case "End":
        next = entries.at(-1);
        break;
      default:
        // Enter and Space reach the focused entry, a button, which they click.
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    next?.focus();
  };
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("keydown", onKey, true);
  menuCloser = () => {
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("keydown", onKey, true);
  };
  // At the click, but never outside the window.
  const place = box.getBoundingClientRect();
  box.style.left = `${Math.max(4, Math.min(x, window.innerWidth - place.width - 8))}px`;
  box.style.top = `${Math.max(4, Math.min(y, window.innerHeight - place.height - 8))}px`;
  // The menu takes the focus, so the keys above reach it and not the editor.
  (focusFirst ? (choices(box)[0] ?? box) : box).focus({ preventScroll: true });
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
  button.setAttribute("role", "menuitem");
  button.tabIndex = -1;
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
  const choose = () => {
    if (button.disabled) return;
    closeMenu(true);
    run();
  };
  // On mousedown, as menus do; the menu is gone before a click could follow.
  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    choose();
  });
  // Enter or Space on the focused entry.
  button.addEventListener("click", choose);
  box.append(button);
}

/** A line between the groups of a menu. */
export function separator(box: HTMLElement) {
  box.append(document.createElement("hr"));
}

/** Below the caret, where a menu asked for from the keyboard goes in an editor. */
export function cursorPoint(view: EditorView): { x: number; y: number } {
  const coords = view.coordsAtPos(view.state.selection.main.head);
  if (coords) return { x: coords.left, y: coords.bottom };
  const rect = view.contentDOM.getBoundingClientRect();
  return { x: rect.left, y: rect.top };
}

/** Reads the clipboard's text, reporting when the browser keeps it away. */
async function paste(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    toast.error(i18next.t("editor.actions.clipboardRead"));
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
    toast.error(i18next.t("editor.actions.clipboardWrite"));
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
      const keyboard = fromKeyboard(event);
      // Like the browser's own menu: clicking outside the selection puts
      // the caret there, so Cut and Copy act on what was right-clicked.
      // From the keyboard, the menu is about the selection as it is.
      const pos = keyboard ? null : view.posAtCoords({ x: event.clientX, y: event.clientY });
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
      const { x, y } = keyboard ? cursorPoint(view) : { x: event.clientX, y: event.clientY };
      openMenu(x, y, (box) => {
        item(
          box,
          i18next.t("editor.actions.undo"),
          () => {
            view.focus();
            undo(view);
          },
          { shortcut: mod("Z"), disabled: undoDepth(view.state) === 0 },
        );
        item(
          box,
          i18next.t("editor.actions.redo"),
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
          i18next.t("editor.files.cut"),
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
          i18next.t("editor.files.copy"),
          () => {
            view.focus();
            void copy(text());
          },
          { shortcut: mod("C"), disabled: !selected },
        );
        item(
          box,
          i18next.t("editor.files.paste"),
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
          i18next.t("editor.actions.selectAll"),
          () => {
            view.focus();
            selectAll(view);
          },
          { shortcut: mod("A") },
        );
      }, { focusFirst: keyboard });
      return true;
    },
  });
}
