/**
 * Searching the book's text (the editor's "Search" pane): one query over
 * many files, each match with its line for the result list, and the same
 * query replacing every match.
 */

export type SearchQuery = {
  pattern: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
};

export type SearchMatch = {
  /** Offsets into the file's text. */
  from: number;
  to: number;
  /** 1-based. */
  line: number;
  /** The matched line, trimmed to a window around the match. */
  preview: string;
  /** Where the match is within `preview`. */
  previewFrom: number;
  previewTo: number;
};

export type FileMatches = { path: string; matches: SearchMatch[] };

export type SearchResult = {
  files: FileMatches[];
  /** Matches over all files, also those past the limit. */
  total: number;
  /** More matches exist than were listed. */
  truncated: boolean;
};

/** Why a query cannot run: an invalid regular expression. */
export class InvalidQueryError extends Error {
  name = "InvalidQueryError";
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The query as a global regular expression, or null when there is nothing to
 * search for. Throws InvalidQueryError for a broken regular expression.
 */
export function compileQuery(query: SearchQuery): RegExp | null {
  if (query.pattern === "") return null;
  let source = query.regex ? query.pattern : escape(query.pattern);
  // Unicode-aware word edges: "Ä" is a letter in a German book.
  if (query.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  try {
    return new RegExp(source, `gmu${query.caseSensitive ? "" : "i"}`);
  } catch (error) {
    throw new InvalidQueryError((error as Error).message);
  }
}

/** How much of a long line shows before a match. */
const CONTEXT_BEFORE = 30;
const PREVIEW_LENGTH = 160;

/** Every match of `re` in `text`, at most `limit` (empty matches are skipped). */
export function findMatches(text: string, re: RegExp, limit = Infinity): { matches: SearchMatch[]; total: number } {
  const matches: SearchMatch[] = [];
  let total = 0;
  // Line starts, found lazily as the matches move forward.
  let line = 1;
  let lineStart = 0;
  re.lastIndex = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (m[0] === "") {
      re.lastIndex = m.index + 1;
      continue;
    }
    total++;
    if (matches.length >= limit) continue;
    const from = m.index;
    const to = from + m[0].length;
    for (let nl = text.indexOf("\n", lineStart); nl !== -1 && nl < from; nl = text.indexOf("\n", lineStart)) {
      line++;
      lineStart = nl + 1;
    }
    let lineEnd = text.indexOf("\n", lineStart);
    if (lineEnd === -1) lineEnd = text.length;
    if (text[lineEnd - 1] === "\r") lineEnd--;
    // A match over several lines shows its first line.
    const shownTo = Math.min(to, lineEnd);
    const start = Math.max(lineStart, from - CONTEXT_BEFORE);
    const end = Math.min(lineEnd, Math.max(shownTo, start + PREVIEW_LENGTH));
    const raw = text.slice(start, end);
    // Leading indentation tells nothing; drop it.
    const lead = start === lineStart ? raw.length - raw.trimStart().length : 0;
    const clipped = start > lineStart;
    const preview = (clipped ? "…" : "") + raw.slice(lead);
    const shift = (clipped ? 1 : 0) - lead - start;
    matches.push({
      from,
      to,
      line,
      preview,
      previewFrom: Math.max(0, from + shift),
      previewTo: Math.max(0, shownTo + shift),
    });
  }
  return { matches, total };
}

/**
 * Searches `files` in order. At most `limit` matches are listed over all
 * files; `total` still counts them all.
 */
export function searchFiles(
  files: Iterable<{ path: string; text: string }>,
  query: SearchQuery,
  limit = 2000,
): SearchResult {
  const re = compileQuery(query);
  const result: SearchResult = { files: [], total: 0, truncated: false };
  if (!re) return result;
  for (const file of files) {
    const left = Math.max(0, limit - result.total);
    const { matches, total } = findMatches(file.text, re, left);
    result.total += total;
    if (matches.length > 0) result.files.push({ path: file.path, matches });
    else if (total > 0) result.truncated = true;
    if (total > matches.length) result.truncated = true;
  }
  return result;
}

/**
 * What replacing every match in `text` changes, in order. With a regular
 * expression, `$1`, `$&`, `$<name>`, … in `replacement` stand for its
 * groups, as in String.replace.
 */
export function replacements(
  text: string,
  query: SearchQuery,
  replacement: string,
): { from: number; to: number; insert: string }[] {
  const re = compileQuery(query);
  if (!re) return [];
  const changes: { from: number; to: number; insert: string }[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    if (m[0] === "") {
      re.lastIndex = m.index + 1;
      continue;
    }
    changes.push({
      from: m.index,
      to: m.index + m[0].length,
      insert: query.regex ? expand(replacement, m[0], m.slice(1), m.groups, text, m.index) : replacement,
    });
  }
  return changes;
}

/** `text` with every match replaced (see `replacements`). */
export function replaceAll(text: string, query: SearchQuery, replacement: string): { text: string; count: number } {
  const changes = replacements(text, query, replacement);
  let next = "";
  let at = 0;
  for (const change of changes) {
    next += text.slice(at, change.from) + change.insert;
    at = change.to;
  }
  return { text: next + text.slice(at), count: changes.length };
}

/** `$&`, `$1`, `$<name>`, `` $` ``, `$'` and `$$` in `replacement`, as String.replace reads them. */
function expand(
  replacement: string,
  match: string,
  groups: (string | undefined)[],
  named: Record<string, string | undefined> | undefined,
  whole: string,
  offset: number,
): string {
  return replacement.replace(/\$(\$|&|`|'|\d{1,2}|<([^>]*)>)/g, (token, what: string, name?: string) => {
    if (what === "$") return "$";
    if (what === "&") return match;
    if (what === "`") return whole.slice(0, offset);
    if (what === "'") return whole.slice(offset + match.length);
    if (name !== undefined) return named ? (named[name] ?? "") : token;
    // "$12" is group 12 when it exists, else group 1 followed by "2".
    const two = Number(what);
    if (what.length === 2 && two >= 1 && two <= groups.length) return groups[two - 1] ?? "";
    const one = Number(what[0]);
    if (one >= 1 && one <= groups.length) return (groups[one - 1] ?? "") + what.slice(1);
    return token;
  });
}
