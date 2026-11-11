import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Config } from "../config";
import { typstDir, typstFonts } from "./typst";

/*
 * The instance's shared Typst fonts (DATA_DIR/typst/fonts), one flat folder
 * of font files. Typst compiles ignore the fonts installed on the server, so
 * documents look the same everywhere; these are the fonts an admin adds for
 * every book (e.g. Liberation Sans for documents that ask for Arial). They
 * come after the book's own fonts (typst.fontPath) and Typst's embedded ones.
 * A file is never replaced, only added or removed.
 */

export class FontError extends Error {}

export type LibraryFont = { file: string; family: string | null; style: string | null; bytes: number };

const FILE = /^[A-Za-z0-9][A-Za-z0-9._ +-]{0,127}\.(ttf|otf|ttc|otc)$/i;

export const validFontFile = (file: string) => FILE.test(file) && !file.includes("..");

/** TrueType, OpenType (CFF), Apple's "true" and collections. */
function isFont(bytes: Buffer): boolean {
  if (bytes.length < 12) return false;
  const tag = bytes.subarray(0, 4).toString("latin1");
  return tag === "\0\x01\0\0" || tag === "OTTO" || tag === "true" || tag === "ttcf";
}

/**
 * The family and style a font names in its `name` table (the first font of a
 * collection): the typographic family (ID 16) if it has one, else the legacy
 * family (ID 1). Null when the table cannot be read.
 */
export function fontNames(bytes: Buffer): { family: string | null; style: string | null } {
  const none = { family: null, style: null };
  try {
    let offset = 0;
    if (bytes.subarray(0, 4).toString("latin1") === "ttcf") offset = bytes.readUInt32BE(12);
    const tables = bytes.readUInt16BE(offset + 4);
    let name = -1;
    for (let i = 0; i < tables; i++) {
      const record = offset + 12 + i * 16;
      if (bytes.subarray(record, record + 4).toString("latin1") === "name") name = bytes.readUInt32BE(record + 8);
    }
    if (name < 0) return none;
    const count = bytes.readUInt16BE(name + 2);
    const strings = name + bytes.readUInt16BE(name + 4);
    const found: Record<number, { score: number; text: string }> = {};
    for (let i = 0; i < count; i++) {
      const r = name + 6 + i * 12;
      const platform = bytes.readUInt16BE(r);
      const encoding = bytes.readUInt16BE(r + 2);
      const language = bytes.readUInt16BE(r + 4);
      const id = bytes.readUInt16BE(r + 6);
      if (![1, 2, 16, 17].includes(id)) continue;
      const raw = bytes.subarray(strings + bytes.readUInt16BE(r + 10), strings + bytes.readUInt16BE(r + 10) + bytes.readUInt16BE(r + 8));
      let text: string;
      let score: number;
      if (platform === 3 || platform === 0) {
        text = Buffer.from(raw).swap16().toString("utf16le");
        score = platform === 3 && language === 0x409 ? 3 : 2;
      } else if (platform === 1 && encoding === 0) {
        text = raw.toString("latin1");
        score = 1;
      } else continue;
      if (!found[id] || found[id].score < score) found[id] = { score, text: text.trim() };
    }
    return { family: (found[16] ?? found[1])?.text || null, style: (found[17] ?? found[2])?.text || null };
  } catch {
    return none;
  }
}

/** Every font file in the library, with the family to name in `#set text(font: …)`. */
export async function listFonts(config: Config): Promise<LibraryFont[]> {
  const dir = typstFonts(config);
  const fonts: LibraryFont[] = [];
  for (const entry of (await readdir(dir, { withFileTypes: true }).catch(() => [])).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (!entry.isFile() || !validFontFile(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const bytes = await readFile(full);
    fonts.push({ file: entry.name, ...fontNames(bytes), bytes: (await stat(full)).size });
  }
  return fonts;
}

/** Adds one font file under its own name. */
export async function addFont(config: Config, file: string, bytes: Buffer, maxBytes: number): Promise<LibraryFont> {
  const name = path.basename(file.replace(/\\/g, "/"));
  if (!validFontFile(name)) throw new FontError("typstFonts.invalidName");
  if (bytes.length > maxBytes) throw new FontError("typstFonts.tooLarge");
  if (!isFont(bytes)) throw new FontError("typstFonts.notFont");
  const dir = typstFonts(config);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, name);
  // Case-insensitively: "Arial.ttf" and "arial.ttf" are one file to an admin.
  const taken = (await readdir(dir)).some((existing) => existing.toLowerCase() === name.toLowerCase());
  if (taken || existsSync(target)) throw new FontError("typstFonts.exists");
  // Written beside the library and moved in, so a compile never sees half a font.
  const staging = path.join(typstDir(config), "staging");
  await mkdir(staging, { recursive: true });
  const partial = path.join(staging, `font-${process.pid}-${Date.now()}`);
  await writeFile(partial, bytes, { flag: "wx" });
  await rename(partial, target);
  return { file: name, ...fontNames(bytes), bytes: bytes.length };
}

/** Removes one font file; false if there was none. */
export async function removeFont(config: Config, file: string): Promise<boolean> {
  if (!validFontFile(file)) return false;
  const target = path.join(typstFonts(config), file);
  if (!existsSync(target)) return false;
  await rm(target, { force: true });
  return true;
}
