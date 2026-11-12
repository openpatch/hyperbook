import { EditorView } from "@codemirror/view";
import { DRAG_TYPE, type NodeRef } from "./file-tree";
import { pageOf } from "./files";
import { IMAGE, linkBase, publicPath, relativeTo } from "./page-language";

/** What a page does with files dropped or pasted into it. */
export type DropHandler = {
  /** Files from the computer: uploaded, and linked at from–to. */
  files: (view: EditorView, files: File[], from: number, to: number) => void;
  /** Files of the book, dragged from the tree: linked at from–to. */
  nodes: (view: EditorView, nodes: NodeRef[], from: number, to: number) => void;
};

/**
 * Files dropped onto a page or pasted into it (a screenshot, say), and files
 * dragged from the tree, become links; `handler` is asked each time, so it
 * may change after the editor was made.
 */
export function fileDrop(handler: () => DropHandler) {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const data = event.clipboardData;
      const files = [...(data?.files ?? [])];
      // Text that comes with a picture (cells from a spreadsheet) is pasted as text.
      if (files.length === 0 || data?.getData("text/plain")) return false;
      event.preventDefault();
      const { from, to } = view.state.selection.main;
      handler().files(view, files, from, to);
      return true;
    },
    drop(event, view) {
      const data = event.dataTransfer;
      if (!data) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos === null) return false;
      const tree = data.getData(DRAG_TYPE);
      if (tree) {
        event.preventDefault();
        handler().nodes(view, JSON.parse(tree) as NodeRef[], pos, pos);
        return true;
      }
      const files = [...data.files];
      if (files.length === 0) return false;
      event.preventDefault();
      handler().files(view, files, pos, pos);
      return true;
    },
  });
}

/**
 * Markdown that links `file` from `page`: an image as an image, a page or
 * any other file as a link; relative to the page when it is in book/.
 * Null for a file the built book does not serve (a snippet, say).
 */
export function linkTo(page: string, file: string): string | null {
  const href = pageOf(file) ?? publicPath(file);
  if (!href) return null;
  const base = linkBase(page);
  const target = encodeURI(base ? relativeTo(base, href) : href);
  const name = file.split("/").pop()!;
  const label = name.replace(/\..*$/, "");
  return IMAGE.test(file) ? `![${label}](${target})` : `[${label}](${target})`;
}

/**
 * Where a file dropped onto `page` is kept: next to the page in book/, in
 * public/ for others. A pasted screenshot ("image.png") is named after the
 * page; spaces become dashes, so the link needs no escaping; a taken name
 * gets a number ("intro-2.png").
 */
export function dropPath(page: string, fileName: string, taken: (path: string) => boolean): string {
  const segments = page.split("/");
  const pageName = segments.pop()!.replace(/\..*$/, "");
  const folder = page.startsWith("book/") ? segments.join("/") : "public";
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot).toLowerCase() : "";
  let stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  if (!stem || /^image$/i.test(stem))
    stem = pageName === "index" && segments.length > 1 ? segments[segments.length - 1]! : pageName;
  stem = stem.replace(/[\s/\\]+/g, "-");
  for (let i = 1; ; i++) {
    const path = `${folder}/${stem}${i > 1 ? `-${i}` : ""}${ext}`;
    if (!taken(path)) return path;
  }
}
