import { RangeSetBuilder } from "@codemirror/state";
import i18next from "i18next";
import { Decoration, type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate, WidgetType } from "@codemirror/view";

/*
 * Element content written inside a page, like the pseudocode of
 *
 *   :::struktolab{lang=en}
 *   ```
 *   if x > 0: …
 *   ```
 *   :::
 *
 * and element files a page points at, like `::learningmap{src="/map.learningmap"}`.
 * The Markdown editor marks both with an "Edit visually" button.
 */

export type Block = InlineBlock | FileRef;

export type FileRef = {
  type: "file";
  kind: "learningmap" | "excalidraw" | "jmp" | "bitflow" | "struktolab" | "blockflow" | "blockflow-project";
  src: string;
  /** End of the directive, where the button goes. */
  lineEnd: number;
};

export type InlineBlock = {
  type: "inline";
  kind: "struktolab";
  /** Where the code inside the fence starts and ends in the page. */
  from: number;
  to: number;
  code: string;
  /** The directive's `lang`, if it has one. */
  lang: string | null;
  /** End of the directive's line, where the button goes. */
  lineEnd: number;
};

const BLOCK = /^:{3,}struktolab(\{[^}\n]*\})?[ \t]*\n(`{3,}|~{3,})[^\n]*\n([\s\S]*?)^\2[ \t]*$/gm;
const LANG = /(?:^|[\s{])lang=["']?([A-Za-z-]+)/;

// Two colons or more: `::bitflow-player{src=…}` and the container
// `::::blockflow-editor{src=…}` alike.
const FILE_DIRECTIVE = /^:{2,}(learningmap|excalidraw|jmp|bitflow|struktolab|blockflow-player|blockflow-editor)\{([^}\n]*)\}/gm;
/** The directive names above, by the element kind their file belongs to. */
const FILE_KIND: Record<string, FileRef["kind"]> = {
  learningmap: "learningmap",
  excalidraw: "excalidraw",
  jmp: "jmp",
  bitflow: "bitflow",
  struktolab: "struktolab",
  "blockflow-player": "blockflow",
  "blockflow-editor": "blockflow",
};
/** The `project` attribute: a .blockflow/.json project file instead of `src`. */
const PROJECT = /(?:^|\s)project=(?:"([^"]*)"|'([^']*)'|([^\s"'}]+))/;
const SRC = /(?:^|\s)src=(?:"([^"]*)"|'([^']*)'|([^\s"'}]+))/;

export function findBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const m of text.matchAll(FILE_DIRECTIVE)) {
    const src = SRC.exec(m[2]!);
    let value = src && (src[1] ?? src[2] ?? src[3]);
    let kind: FileRef["kind"] = FILE_KIND[m[1]!]!;
    if (!value && m[1] === "blockflow-editor") {
      // `::::blockflow-editor{project="tutorial.blockflow"}` names a project file.
      const project = PROJECT.exec(m[2]!);
      value = project && (project[1] ?? project[2] ?? project[3]);
      if (value) kind = "blockflow-project";
    }
    if (value) blocks.push({ type: "file", kind, src: value, lineEnd: m.index + m[0].length });
  }
  for (const m of text.matchAll(BLOCK)) {
    const lineEnd = m.index + m[0].indexOf("\n");
    const from = m.index + m[0].indexOf("\n", lineEnd - m.index + 1) + 1;
    // The code without the newline before the closing fence.
    const code = m[3]!.replace(/\n$/, "");
    blocks.push({ type: "inline", kind: "struktolab", from, to: from + code.length, code, lang: LANG.exec(m[1] ?? "")?.[1] ?? null, lineEnd });
  }
  return blocks;
}

class EditButton extends WidgetType {
  constructor(
    readonly block: Block,
    readonly onEdit: (block: Block, view: EditorView) => void,
  ) {
    super();
  }
  eq(other: EditButton) {
    return JSON.stringify(other.block) === JSON.stringify(this.block);
  }
  toDOM(view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = i18next.t("editor.actions.editVisually");
    button.className = "cm-edit-visually";
    button.addEventListener("mousedown", (e) => e.preventDefault());
    button.addEventListener("click", () => this.onEdit(this.block, view));
    return button;
  }
  ignoreEvent() {
    return true;
  }
}

/** Buttons on the element blocks of a page; `onEdit` opens the visual editor. */
export function editVisuallyButtons(onEdit: (block: Block, view: EditorView) => void) {
  const build = (view: EditorView): DecorationSet => {
    const builder = new RangeSetBuilder<Decoration>();
    // RangeSetBuilder wants them in order.
    const blocks = findBlocks(view.state.doc.toString()).sort((a, b) => a.lineEnd - b.lineEnd);
    for (const block of blocks) {
      builder.add(block.lineEnd, block.lineEnd, Decoration.widget({ widget: new EditButton(block, onEdit), side: 1 }));
    }
    return builder.finish();
  };
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = build(update.view);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

/**
 * The book file a page's `src` names, found like the build does: in public/,
 * in book/, then next to the page; null if there is none.
 */
export function resolveSrc(src: string, page: string, exists: (file: string) => boolean): string | null {
  const join = (...parts: string[]) => {
    const out: string[] = [];
    for (const part of parts.join("/").split("/")) {
      if (part === "" || part === ".") continue;
      if (part === "..") out.pop();
      else out.push(part);
    }
    return out.join("/");
  };
  const pageDir = page.startsWith("book/") ? page.slice("book/".length).split("/").slice(0, -1).join("/") : "";
  for (const candidate of [join("public", src), join("book", src), join("book", pageDir, src)]) {
    if (exists(candidate)) return candidate;
  }
  return null;
}
