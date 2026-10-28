import { isMap, parseDocument } from "yaml";

/*
 * A page's frontmatter as a form. Writing the form back changes only the
 * keys the form knows, so other keys, their order and comments stay.
 */

export type Frontmatter = {
  /** From the first `---` to the end of the closing `---` line. */
  from: number;
  to: number;
  yaml: string;
};

const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?\r?\n)?(?:---|\.\.\.)[ \t]*(?=\r?\n|$)/;

export function findFrontmatter(text: string): Frontmatter | null {
  const m = FRONTMATTER.exec(text);
  return m ? { from: 0, to: m[0].length, yaml: m[1] ?? "" } : null;
}

export type PageForm = {
  name: string;
  description: string;
  permaid: string;
  keywords: string;
  index: string;
  hidden: boolean;
  /** "" follows the book. */
  toc: "" | "on" | "off";
  layout: "" | "wide" | "standalone";
  qrcode: boolean;
  prev: string;
  next: string;
  /** A key of the password registry, or a password with a hint. */
  protectKey: string;
  password: string;
  passwordHint: string;
};

const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

export class FrontmatterError extends Error {}

function load(yaml: string) {
  const doc = parseDocument(yaml);
  if (doc.errors.length > 0) throw new FrontmatterError(doc.errors[0]!.message.split("\n")[0]!);
  if (doc.contents !== null && !isMap(doc.contents)) throw new FrontmatterError("The page settings are not a list of keys");
  return doc;
}

export function toPageForm(text: string): PageForm {
  const fm = findFrontmatter(text);
  const data = ((fm ? load(fm.yaml).toJS() : null) ?? {}) as Record<string, unknown>;
  const protect = data.protect;
  const protectObj = (typeof protect === "object" && protect !== null ? protect : {}) as Record<string, unknown>;
  return {
    name: str(data.name) || str(data.title),
    description: str(data.description),
    permaid: str(data.permaid),
    keywords: Array.isArray(data.keywords) ? data.keywords.map(str).join(", ") : str(data.keywords),
    index: str(data.index),
    hidden: data.navigation === "hidden" || data.hide === true,
    toc: data.toc === true ? "on" : data.toc === false ? "off" : "",
    layout: data.layout === "wide" || data.layout === "standalone" ? data.layout : "",
    qrcode: data.qrcode === true,
    prev: data.prev === null ? "" : str(data.prev),
    next: data.next === null ? "" : str(data.next),
    protectKey: typeof protect === "string" ? protect : "",
    password: str(protectObj.password),
    passwordHint: str(protectObj.description),
  };
}

/** `text` with its frontmatter set from the form; adds a frontmatter if it has none. */
export function withPageForm(text: string, form: PageForm): string {
  const fm = findFrontmatter(text);
  const doc = load(fm?.yaml ?? "");
  const set = (key: string, value: unknown) => {
    if (value === "" || value === undefined) doc.delete(key);
    else doc.set(key, value);
  };
  // Hyperbook reads name before title; keep whichever the page uses.
  const nameKey = doc.has("title") && !doc.has("name") ? "title" : "name";
  set(nameKey, form.name.trim());
  set("description", form.description.trim());
  set("permaid", form.permaid.trim());
  const keywords = form.keywords.split(",").map((k) => k.trim()).filter(Boolean);
  set("keywords", keywords.length ? keywords : undefined);
  const index = form.index.trim();
  set("index", index === "" ? undefined : Number.isFinite(Number(index)) ? Number(index) : index);
  doc.delete("hide");
  set("navigation", form.hidden ? "hidden" : undefined);
  set("toc", form.toc === "" ? undefined : form.toc === "on");
  set("layout", form.layout);
  set("qrcode", form.qrcode || undefined);
  // An empty prev or next written by hand hides the button; leave those alone.
  const data = (doc.toJS() ?? {}) as Record<string, unknown>;
  for (const key of ["prev", "next"] as const) {
    if (form[key].trim() || data[key] !== null) set(key, form[key].trim());
  }
  if (form.protectKey.trim()) set("protect", form.protectKey.trim());
  else if (form.password) {
    set("protect", form.passwordHint.trim() ? { password: form.password, description: form.passwordHint.trim() } : { password: form.password });
  } else doc.delete("protect");

  const empty = doc.contents === null || (isMap(doc.contents) && doc.contents.items.length === 0);
  const yaml = empty ? "" : doc.toString({ lineWidth: 0 });
  if (!fm) return empty ? text : `---\n${yaml}---\n\n${text}`;
  return (empty ? "" : `---\n${yaml}---`) + (empty ? text.slice(fm.to).replace(/^\r?\n+/, "") : text.slice(fm.to));
}
