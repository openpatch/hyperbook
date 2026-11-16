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
 * Files dropped onto a page or a Typst file or pasted into it (a screenshot,
 * say), and files dragged from the tree, become links; `handler` is asked each time, so it
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
 * What links `file` from `page`, relative to the page: in Markdown an image
 * as an image, a page or any other file as a link; in Typst an image as
 * `#image`, another Typst file as `#include`, anything else as its path.
 * Null for a file a page cannot link (a snippet, say).
 */
export function linkTo(page: string, file: string): string | null {
  if (page.endsWith(".typ")) {
    const target = relativeFile(page, file);
    if (IMAGE.test(file)) return `#image(${JSON.stringify(target)})`;
    if (file.endsWith(".typ")) return `#include ${JSON.stringify(target)}`;
    return JSON.stringify(target);
  }
  const href = pageOf(file) ?? publicPath(file);
  if (!href) return null;
  const base = linkBase(page);
  const target = encodeURI(base ? relativeTo(base, href) : href);
  const name = file.split("/").pop()!;
  const label = name.replace(/\..*$/, "");
  return IMAGE.test(file) ? `![${label}](${target})` : `[${label}](${target})`;
}

/** `file` as Typst finds it from `from`: relative to its folder ("pic.png", "../a/pic.png"). */
export function relativeFile(from: string, file: string): string {
  const base = from.split("/").slice(0, -1);
  const target = file.split("/");
  let common = 0;
  while (common < base.length && common < target.length - 1 && base[common] === target[common]) common++;
  return "../".repeat(base.length - common) + target.slice(common).join("/");
}

/**
 * Where a file dropped onto `page` (a Markdown page or a Typst file) is kept:
 * next to it, so the link stays short and relative. A pasted screenshot
 * ("image.png") is named after the page; spaces become dashes, so the link
 * needs no escaping; a taken name gets a number ("intro-2.png").
 */
export function dropPath(page: string, fileName: string, taken: (path: string) => boolean): string {
  const segments = page.split("/");
  const pageName = segments.pop()!.replace(/\..*$/, "");
  const folder = segments.length ? `${segments.join("/")}/` : "";
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot).toLowerCase() : "";
  let stem = dot > 0 ? fileName.slice(0, dot) : fileName;
  if (!stem || /^image$/i.test(stem))
    stem = pageName === "index" && segments.length > 1 ? segments[segments.length - 1]! : pageName;
  stem = stem.replace(/[\s/\\]+/g, "-");
  for (let i = 1; ; i++) {
    const path = `${folder}${stem}${i > 1 ? `-${i}` : ""}${ext}`;
    if (!taken(path)) return path;
  }
}
