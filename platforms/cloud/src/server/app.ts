import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { createAdminApp } from "./admin/app";
import { createBooksApp } from "./books/app";
import { PREVIEW_SUFFIX, createPreviewApp } from "./books/preview";
import type { Deps } from "./deps";
import { bookSlugs, books } from "./db/schema";
import { bookByDomain } from "./domain/custom-domains";
import { labelFromHost } from "./domain/slug";

/**
 * One process serves two kinds of hosts, told apart by the Host header:
 *
 *   ADMIN_ORIGIN               admin UI and API
 *   <label>.<BOOKS_DOMAIN>     published books (teacher-written content)
 *   <slug>--preview.<…>        a book's newest build, for its teachers
 *   a book's custom domain     the book, once the domain is active (M5)
 *
 * They are separate Hono apps, so middleware meant for one (such as the admin
 * session cookie) can never run on the other. Any other host gets 404.
 */
export function createApp(deps: Deps, options: { webRoot?: string } = {}) {
  const { config } = deps;
  const admin = createAdminApp(deps, options);
  const bookHosts = createBooksApp(deps);
  const previewHosts = createPreviewApp(deps);

  const app = new Hono();

  // Answered on every host, so container health checks can reach it by IP.
  app.get("/api/health", (c) => c.json({ ok: true }));

  // Caddy's on-demand TLS asks here before getting a certificate for a host,
  // so certificates are only issued for addresses that exist.
  app.get("/api/tls-check", (c) => {
    const domain = (c.req.query("domain") ?? "").toLowerCase();
    const stripPort = (host: string) => host.replace(/:\d+$/, "");
    if (domain && domain === stripPort(config.adminHost)) return c.text("ok");
    const label = labelFromHost(domain, stripPort(config.booksDomain));
    if (label?.endsWith(PREVIEW_SUFFIX)) {
      const slug = label.slice(0, -PREVIEW_SUFFIX.length);
      const known = deps.db.select({ id: books.id }).from(books).where(eq(books.slug, slug)).get();
      return known ? c.text("ok") : c.text("unknown", 404);
    }
    if (label) {
      const known =
        deps.db.select({ id: books.id }).from(books).where(eq(books.slug, label)).get() ??
        deps.db.select({ id: bookSlugs.bookId }).from(bookSlugs).where(eq(bookSlugs.oldSlug, label)).get();
      if (known) return c.text("ok");
    }
    if (domain && bookByDomain(deps.db, domain)) return c.text("ok");
    return c.text("unknown", 404);
  });

  app.all("*", (c) => {
    const host = c.req.header("host")?.toLowerCase();
    if (host === config.adminHost) {
      return admin.fetch(c.req.raw, c.env);
    }
    const label = labelFromHost(host, config.booksDomain);
    if (label?.endsWith(PREVIEW_SUFFIX)) {
      return previewHosts.fetch(c.req.raw, { ...(c.env as object), label: label.slice(0, -PREVIEW_SUFFIX.length) });
    }
    if (label) {
      return bookHosts.fetch(c.req.raw, { ...(c.env as object), label });
    }
    const custom = host ? bookByDomain(deps.db, host) : undefined;
    if (custom) {
      return bookHosts.fetch(c.req.raw, { ...(c.env as object), label: custom.slug, customDomain: true });
    }
    return c.text("Unknown host.", 404);
  });

  return app;
}
