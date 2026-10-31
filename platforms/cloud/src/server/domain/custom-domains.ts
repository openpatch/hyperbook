import { and, eq, isNotNull, ne } from "drizzle-orm";
import type { Config } from "../config";
import type { Db } from "../db/client";
import { bookSlugs, books } from "../db/schema";
import type { Dns } from "../dns";
import type { UrlFetcher } from "../https";
import type { BookRow } from "./books";

/*
 * A book may have one custom domain (M5). The teacher points it at the book
 * with a CNAME to <slug>.<BOOKS_DOMAIN>; only whoever controls the domain's
 * DNS can create that record, so it also proves the claim. Once it is found,
 * the domain is active: the book is served there and its address on the
 * books domain redirects to it.
 *
 * A/AAAA records do not count: every book shares the server's addresses, so
 * they would not say which book a domain belongs to. Domains without a
 * subdomain (which cannot have a CNAME) are therefore not supported.
 */

const NAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const stripPort = (host: string) => host.replace(/:\d+$/, "");

const within = (name: string, parent: string) => name === parent || name.endsWith("." + parent);

/** Why `name` cannot be a custom domain, or null if it can. */
export function domainNameProblem(config: Config, name: string): string | null {
  if (!NAME_RE.test(name)) return "Enter a domain like buch.schule.de";
  // Inside or above the platform's own hosts, a book would share a site with
  // the admin UI or with other books.
  for (const own of [stripPort(config.adminHost), stripPort(config.booksDomain)]) {
    if (within(name, own) || within(own, name)) return "This domain belongs to the platform";
  }
  return null;
}

/** Where the book's domain must point (CNAME). */
export function domainTarget(config: Config, slug: string): string {
  return `${slug}.${stripPort(config.booksDomain)}`;
}

/** The active custom domain of the book, or null. */
export function activeDomain(book: Pick<BookRow, "domain" | "domainVerifiedAt">): string | null {
  return book.domain && book.domainVerifiedAt ? book.domain : null;
}

/** Where students reach a hosted book: its active custom domain, else <slug>.<BOOKS_DOMAIN>. */
export function publicOrigin(config: Config, book: Pick<BookRow, "slug" | "domain" | "domainVerifiedAt">): string {
  const domain = activeDomain(book);
  // Development: custom domains are served on the same port as the books.
  const port = config.booksDomain.match(/:\d+$/)?.[0] ?? "";
  return domain
    ? `${config.booksProtocol}//${domain}${port}`
    : `${config.booksProtocol}//${book.slug}.${config.booksDomain}`;
}

/** The book whose active custom domain `host` is. */
export function bookByDomain(db: Db, host: string): BookRow | undefined {
  return db
    .select()
    .from(books)
    .where(and(eq(books.domain, stripPort(host.toLowerCase())), isNotNull(books.domainVerifiedAt)))
    .get();
}

/**
 * Looks the domain up. `problem` is null when it points at this book,
 * otherwise says (to the teacher) what is missing.
 */
export async function checkDomain(
  db: Db,
  dns: Dns,
  config: Config,
  book: BookRow,
): Promise<{ problem: string | null }> {
  if (!book.domain) return { problem: "No domain is set" };
  const target = domainTarget(config, book.slug);
  // A CNAME made before the book was renamed still names it.
  const oldSlugs = db.select({ slug: bookSlugs.oldSlug }).from(bookSlugs).where(eq(bookSlugs.bookId, book.id)).all();
  const targets = [target, ...oldSlugs.map((o) => domainTarget(config, o.slug))];
  try {
    const cnames = (await dns.cname(book.domain)).map((n) => n.toLowerCase().replace(/\.$/, ""));
    if (!cnames.some((n) => targets.includes(n))) {
      return { problem: `There is no CNAME record from ${book.domain} to ${target} yet.` };
    }
  } catch {
    return { problem: "The DNS lookup failed. Try again in a moment." };
  }
  const taken = db
    .select({ id: books.id })
    .from(books)
    .where(and(eq(books.domain, book.domain), isNotNull(books.domainVerifiedAt), ne(books.id, book.id)))
    .get();
  if (taken) return { problem: "Another book uses this domain already." };
  return { problem: null };
}

/**
 * Whether HTTPS works on an active custom domain: fetches /api/health there
 * once. The request goes through the TLS proxy, which obtains the certificate
 * on demand now that /api/tls-check allows the domain, so a success also warms
 * the certificate for the first real visitor. Stateless: nothing is stored.
 */
export async function checkDomainHttps(domain: string, fetchUrl: UrlFetcher): Promise<{ problem: string | null }> {
  try {
    const res = await fetchUrl(`https://${domain}/api/health`);
    return res.ok ? { problem: null } : { problem: `HTTPS works, but /api/health answered ${res.status}.` };
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code ?? "";
    if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA")
      return { problem: "The domain no longer points at this platform. Check the DNS record." };
    if (/CERT|SSL|TLS/i.test(code))
      return { problem: "The certificate could not be obtained. Check that the domain points at this platform." };
    return { problem: "HTTPS is not reachable yet. Try again in a moment." };
  }
}

/** The book's domain as the admin API shows it. */
export function publicDomain(config: Config, book: BookRow) {
  if (!book.domain) return null;
  return {
    name: book.domain,
    active: book.domainVerifiedAt !== null,
    target: domainTarget(config, book.slug),
    checkedAt: book.domainCheckedAt?.getTime() ?? null,
    problem: book.domainProblem,
  };
}
