import type { VisualKind } from "../../visual/protocol";

/** The file name's extension, lowercased: "book/a.SB3" → "sb3". */
export const extension = (path: string) => path.split("/").pop()!.split(".").slice(1).pop()?.toLowerCase() ?? "";

/** Files that open in their element's own editor (see visual.html), by extension. */
export function visualKind(path: string): VisualKind | null {
  switch (extension(path)) {
    case "sb3":
      return "blockflow";
    case "blockflow":
      return "blockflow-project";
    case "bitflow":
      return "bitflow";
    case "struktolab":
      return "struktolab";
    case "learningmap":
      return "learningmap";
    case "excalidraw":
      return "excalidraw";
    case "jmp":
      return "jmp";
    default:
      return null;
  }
}

/**
 * Before saving: the editors all write JSON, except struktolab's pseudocode
 * and blockflow's .sb3 (base64 of the zip), and a broken file never lands in
 * the book.
 */
export function visualProblem(kind: VisualKind, text: string): string | null {
  if (kind === "blockflow") {
    if (!text.trim()) return null;
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0));
    } catch {
      return "This is not valid base64.";
    }
    // A zip starts with "PK".
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b)
      return "This is not a .sb3 file: the decoded bytes are not a zip.";
    return null;
  }
  // All the others write JSON, except struktolab's pseudocode.
  if (kind !== "struktolab-pseudocode" && text.trim()) {
    try {
      JSON.parse(text);
    } catch (error) {
      return `This is not valid JSON: ${(error as Error).message}`;
    }
  }
  return null;
}
