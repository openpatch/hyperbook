import { zipSync } from "fflate";
import type { FileChange } from "../../../shared/schemas";
import { api, unwrap } from "@/lib/api";
import { extension, visualKind } from "./visual-kinds";

export { extension };

export type Listing = Awaited<ReturnType<typeof fetchListing>>;
export type FileEntry = Listing["files"][number];

export const fetchListing = (bookId: string) =>
  unwrap(api.books[":id"].files.$get({ param: { id: bookId } }));

export const commitFiles = (bookId: string, changes: FileChange[], message?: string) =>
  unwrap(api.books[":id"].files.commit.$post({ param: { id: bookId }, json: { changes, message } }));

export const rawUrl = (bookId: string, path: string) =>
  `/api/books/${bookId}/files/raw?path=${encodeURIComponent(path)}`;

export type ReferencesResult = Awaited<ReturnType<typeof fetchReferences>>;

/** Where a file, or a folder of files, is referenced from: what a rename, move or delete would touch. */
export const fetchReferences = (bookId: string, path: string) =>
  unwrap(
    api.books[":id"].files.references.$get({ param: { id: bookId }, query: { path } }),
  );

/** Larger files are not opened as text, even if they are. */
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

/** A binary element file (.sb3) may be larger: its visual editor opens it. */
const MAX_VISUAL_BYTES = 64 * 1024 * 1024;

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

export type Loaded =
  | { kind: "text"; oid: string; text: string; /** Set when the text is base64 of binary bytes (a .sb3). */
      encoding?: "base64" }
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
  if (visualKind(path) && bytes.length <= MAX_VISUAL_BYTES) {
    // A binary element file (a .sb3): its visual editor gets the bytes
    // base64-encoded as the document text.
    return { kind: "text", oid, text: toBase64(bytes), encoding: "base64" };
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

/** Source extensions of a page, longest first (as in shared/references.ts). */
const PAGE_EXTENSIONS = [".md.hbs", ".md.json", ".md.yml", ".md"];

/** A page of the book: in book/ or glossary/ with a page extension. */
export function isPage(path: string): boolean {
  return (
    (path.startsWith("book/") || path.startsWith("glossary/")) &&
    PAGE_EXTENSIONS.some((ext) => path.endsWith(ext))
  );
}

/**
 * A page written as Markdown, which the build may render as a template:
 * `.md`, or `.md.hbs` where the page's output is a Handlebars template.
 * (Snippets in snippets/ are templates too, but no pages.)
 */
export function isMarkdownPage(path: string): boolean {
  return isPage(path) && (path.endsWith(".md") || path.endsWith(".md.hbs"));
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

/**
 * The file the built book shows at `href`: a page, or a file from public/ or
 * book/; null for what no file of the book makes (a search page, say).
 */
export function fileAt(href: string, files: string[]): string | null {
  let route: string;
  try {
    route = decodeURIComponent(href.split(/[?#]/)[0]!);
  } catch {
    return null;
  }
  route = route.replace(/\.html$/, "").replace(/(.)\/+$/, "$1");
  return (
    files.find((f) => pageOf(f) === route) ??
    files.find((f) => f === `public${route}` || f === `book${route}`) ??
    null
  );
}

/** The index.md of a folder inside book/, so a section; its frontmatter may set the section navigation. */
export function isSectionIndex(path: string): boolean {
  const m = /^book\/(.+)\.(md|md\.hbs|md\.json|md\.yml)$/.exec(path);
  if (!m) return false;
  const segments = m[1]!.split("/");
  return segments.length > 1 && segments[segments.length - 1] === "index";
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
  if (name.endsWith(".blockflow"))
    return JSON.stringify({ title: "New tutorial" }, null, 2) + "\n";
  if (name.endsWith(".sb3")) return toBase64(emptySb3());
  return "";
}

/** How a starter's content is committed: a .sb3 is binary, so base64. */
export const starterEncoding = (path: string): "utf8" | "base64" => (extension(path) === "sb3" ? "base64" : "utf8");

/** An empty Scratch project: a zip with project.json and the default backdrop. */
function emptySb3(): Uint8Array {
  const backdrop =
    '<svg version="1.1" width="480" height="360" viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M0 0h480v360H0z" fill="#ffffff" stroke="none"/></svg>';
  const project = {
    targets: [
      {
        isStage: true,
        name: "Stage",
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [
          {
            assetId: "cd21514d0531fdffb22204e0ec5ed84a",
            name: "backdrop1",
            md5ext: "cd21514d0531fdffb22204e0ec5ed84a.svg",
            dataFormat: "svg",
            rotationCenterX: 240,
            rotationCenterY: 180,
          },
        ],
        sounds: [],
        volume: 100,
        layerOrder: 0,
        tempo: 60,
        videoTransparency: 50,
        videoState: "on",
        textToSpeechLanguage: null,
      },
    ],
    monitors: [],
    extensions: [],
    meta: { semver: "3.0.0", vm: "0.2.0", agent: "hyperbook-cloud" },
  };
  const encode = (value: string) => new TextEncoder().encode(value);
  return zipSync({
    "project.json": encode(JSON.stringify(project)),
    "cd21514d0531fdffb22204e0ec5ed84a.svg": encode(backdrop),
  });
}
