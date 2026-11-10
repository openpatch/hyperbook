import type { HyperbookJson } from "@hyperbook/types";

/*
 * `exclude` in hyperbook.json: globs for files that must not reach the built
 * site. They are matched against a file's address in the site, without the
 * leading slash — `intern/**` keeps `public/intern/a.pdf` and
 * `book/intern/a.pdf` out alike, because both would be served at
 * `/intern/a.pdf`. Pages are not files in this sense; only what a build
 * copies (public/, and the non-page files of book/ and glossary/) is matched.
 *
 * Supported: `*` (anything but `/`), `**` (anything, `/` included; `** /`
 * also matches no folder at all), `?` (one character but `/`) and
 * `{a,b}` alternatives. Everything else is literal. Matching is
 * case-sensitive.
 */

const SPECIAL = /[.+^$()|[\]\\]/g;

/** One glob as a regular expression over the whole address. */
export function globToRegExp(glob: string): RegExp {
  let source = "";
  let inBraces = 0;
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i]!;
    if (char === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          // `**/` — any folders, or none.
          source += "(?:.*/)?";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
    } else if (char === "?") {
      source += "[^/]";
    } else if (char === "{") {
      inBraces++;
      source += "(?:";
    } else if (char === "}" && inBraces > 0) {
      inBraces--;
      source += ")";
    } else if (char === "," && inBraces > 0) {
      source += "|";
    } else {
      source += char.replace(SPECIAL, "\\$&");
    }
  }
  // An unclosed `{` is a literal brace group that never closes: close it so
  // the expression stays valid.
  source += ")".repeat(inBraces);
  return new RegExp(`^${source}$`);
}

/** Whether a site address (`/a/b.pdf` or `a/b.pdf`) matches one of `globs`. */
export type ExcludeMatcher = (href: string) => boolean;

const never: ExcludeMatcher = () => false;

export function excludeMatcher(globs: readonly string[] | undefined): ExcludeMatcher {
  const patterns = (globs ?? [])
    .filter((glob): glob is string => typeof glob === "string" && glob !== "")
    .map((glob) => globToRegExp(glob.replace(/^\/+/, "")));
  if (patterns.length === 0) return never;
  return (href) => {
    const address = href.replace(/\\/g, "/").replace(/^\/+/, "");
    return patterns.some((pattern) => pattern.test(address));
  };
}

/** The matcher for a book's `exclude` setting. */
export function excludeMatcherFor(
  json: Pick<HyperbookJson, "exclude"> | null | undefined,
): ExcludeMatcher {
  return excludeMatcher(Array.isArray(json?.exclude) ? json.exclude : undefined);
}
