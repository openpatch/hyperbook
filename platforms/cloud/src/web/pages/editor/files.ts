import type { FileChange } from "../../../shared/schemas";
import { api, unwrap } from "@/lib/api";

export type Listing = Awaited<ReturnType<typeof fetchListing>>;
export type FileEntry = Listing["files"][number];

export const fetchListing = (bookId: string) =>
  unwrap(api.books[":id"].files.$get({ param: { id: bookId } }));

export const commitFiles = (bookId: string, changes: FileChange[], message?: string) =>
  unwrap(api.books[":id"].files.commit.$post({ param: { id: bookId }, json: { changes, message } }));

export const rawUrl = (bookId: string, path: string) =>
  `/api/books/${bookId}/files/raw?path=${encodeURIComponent(path)}`;

const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

/** Larger files are not opened as text, even if they are. */
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

export const extension = (path: string) => path.split("/").pop()!.split(".").slice(1).pop()?.toLowerCase() ?? "";

export type Loaded =
  | { kind: "text"; oid: string; text: string }
  | { kind: "image"; oid: string; url: string; size: number }
  | { kind: "binary"; oid: string; size: number };

/** Fetches a file and decides how the editor shows it. */
export async function loadFile(bookId: string, path: string): Promise<Loaded> {
  const res = await fetch(rawUrl(bookId, path));
  if (!res.ok) throw new Error(res.status === 404 ? `${path} does not exist anymore` : `Could not open ${path}`);
  const oid = res.headers.get("x-oid")!;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const imageType = IMAGE_TYPES[extension(path)];
  if (imageType) {
    // Shown through <img>, where SVG scripts never run.
    return { kind: "image", oid, url: URL.createObjectURL(new Blob([bytes], { type: imageType })), size: bytes.length };
  }
  if (bytes.length <= MAX_TEXT_BYTES && !bytes.includes(0)) {
    try {
      return { kind: "text", oid, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
    } catch {
      // Not UTF-8: a binary file.
    }
  }
  return { kind: "binary", oid, size: bytes.length };
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/** The page of the built book that shows `path`, if it is a page. */
export function pageOf(path: string): string | null {
  const m = /^(book|glossary)\/(.+?)\.(md|md\.hbs|md\.json|md\.yml)$/.exec(path);
  if (!m) return null;
  const [, folder, rest] = m;
  const segments = rest!.split("/");
  if (segments[segments.length - 1] === "index") segments.pop();
  const route = "/" + segments.join("/");
  return folder === "glossary" ? `/glossary${route === "/" ? "" : route}` : route;
}

/** "book/a.md" → "book/a (copy).md" */
export function copyName(path: string, taken: (p: string) => boolean): string {
  const slash = path.lastIndexOf("/");
  const dir = path.slice(0, slash + 1);
  const name = path.slice(slash + 1);
  const dot = name.indexOf(".", 1);
  const stem = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot);
  for (let i = 1; ; i++) {
    const candidate = `${dir}${stem} (copy${i > 1 ? ` ${i}` : ""})${ext}`;
    if (!taken(candidate)) return candidate;
  }
}

/** A starter for a new file, by its extension. */
export function starter(path: string, language = "en"): string {
  const name = path.split("/").pop()!;
  if (name.endsWith(".md")) {
    const title = name.replace(/\.md$/, "").replace(/[-_]+/g, " ");
    const heading = title === "index" ? "New page" : title.charAt(0).toUpperCase() + title.slice(1);
    return `---\nname: ${heading}\n---\n\n# ${heading}\n`;
  }
  if (name.endsWith(".json")) return "{}\n";
  if (name.endsWith(".learningmap")) return JSON.stringify({ nodes: [], edges: [] }, null, 2) + "\n";
  if (name.endsWith(".bitflow")) {
    const meta = {
      id: `flow-${crypto.randomUUID()}`,
      title: "",
      locale: language,
      askConfidence: false,
      askReasoning: false,
      pools: [],
      sections: [],
      navigation: "back",
      allowSkip: true,
    };
    return JSON.stringify({ version: 1, meta, nodes: [], edges: [] }, null, 2) + "\n";
  }
  if (name.endsWith(".excalidraw")) {
    return JSON.stringify({ type: "excalidraw", version: 2, source: "hyperbook", elements: [], appState: {}, files: {} }, null, 2) + "\n";
  }
  return "";
}
