/**
 * A book's slug is its subdomain, so it has to be a valid DNS label.
 * "--" is kept free for derived hosts such as <slug>--preview.
 */

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "api",
  "app",
  "assets",
  "cloud",
  "login",
  "mail",
  "preview",
  "static",
  "www",
]);

export type SlugProblem = "format" | "double-hyphen" | "reserved";

export function checkSlug(
  slug: string,
  reserved: ReadonlySet<string> = RESERVED_SLUGS,
): SlugProblem | null {
  if (!SLUG_RE.test(slug)) return "format";
  if (slug.includes("--")) return "double-hyphen";
  if (reserved.has(slug)) return "reserved";
  return null;
}

/**
 * The subdomain label of a request to a book host, or null if the host is not
 * directly below the books domain. The label is returned as-is (it may be a
 * derived host like "<slug>--preview"); callers look it up.
 */
export function labelFromHost(
  host: string | undefined,
  booksDomain: string,
): string | null {
  if (!host) return null;
  const h = host.toLowerCase();
  const suffix = "." + booksDomain;
  if (!h.endsWith(suffix)) return null;
  const label = h.slice(0, -suffix.length);
  return SLUG_RE.test(label) ? label : null;
}
