import fs from "fs/promises";
import { UserError } from "./errors";

/**
 * A config file that exists but could not be parsed.
 *
 * Distinguished from a missing file so callers can keep probing for the other
 * config (a project is either a book or a library) while still failing loudly
 * on one that is present but broken.
 */
export class JsonParseError extends UserError {
  readonly file: string;
  readonly line?: number;
  readonly column?: number;

  constructor(
    file: string,
    reason: string,
    position?: { line: number; column: number },
  ) {
    // `reason` stays the parser's own words: the CLI renders the location
    // separately from `file`/`line`/`column`, so folding the path in here
    // would print it twice.
    super(reason);
    const where = position
      ? `${file}:${position.line}:${position.column}`
      : file;
    this.message = `${where}\n${reason}`;
    this.name = "JsonParseError";
    this.file = file;
    this.line = position?.line;
    this.column = position?.column;
  }
}

/** Turns a character offset into a 1-based line and column. */
function offsetToPosition(
  source: string,
  offset: number,
): { line: number; column: number } {
  const upTo = source.slice(0, offset);
  const lines = upTo.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/**
 * Reads and parses a JSON config.
 *
 * `JSON.parse` reports failures as a bare offset ("at position 214"), which is
 * useless when what the author needs is the line they left a trailing comma on.
 * Missing files reject with the underlying ENOENT error; malformed ones reject
 * with a {@link JsonParseError} carrying the position.
 */
export const readJsonFile = async <T>(file: string): Promise<T> => {
  // Not caught: a missing file is the caller's business, not a parse failure.
  const source = (await fs.readFile(file)).toString();

  try {
    return JSON.parse(source) as T;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    // Node reports the offset, and since v20 also a line/column, in the
    // message text. Prefer the offset since it is present in every version.
    const offsetMatch = /at position (\d+)/.exec(reason);
    const position = offsetMatch
      ? offsetToPosition(source, Number(offsetMatch[1]))
      : undefined;
    throw new JsonParseError(
      file,
      reason.replace(/\s*in JSON at position \d+.*$/, ""),
      position,
    );
  }
};
