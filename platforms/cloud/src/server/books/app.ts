import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { readStudentSession } from "../auth/student-sessions";
import { activeDomain, publicOrigin } from "../domain/custom-domains";
import { getInstanceSettings, legalHref } from "../domain/instance";
import { bookSlugs, books } from "../db/schema";
import type { Deps } from "../deps";
import { buildDir } from "../hosting/storage";
import type { BookBindings, BookEnv } from "./env";
import { impersonatePage, loginPage } from "./pages";
import { escapeHtml, page, pathSegments, serveBuild, serveSharedAssets } from "./serve";
import { STUDENT_COOKIE, studentApi } from "./student-api";

export type { BookBindings };

/** Paths under this prefix belong to the platform (student login, store; M2). */
const PLATFORM_PREFIX = "_hyperbook";

/**
 * Everything served on <slug>.<BOOKS_DOMAIN>: the published build of the
 * book, and under /_hyperbook/ the platform's student login and store.
 * Teacher-written content runs here, so this app never sees the admin session.
 */
export function createBooksApp(deps: Deps) {
  const { db, config } = deps;
  const app = new Hono<BookEnv>();

  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: "Something went wrong on the server" }, 500);
  });

  // Which book this host is, and who is logged in to it.
  app.use(async (c, next) => {
    const label = c.env.label;
    const book = db.select().from(books).where(eq(books.slug, label)).get();

    if (!book) {
      const renamed = db
        .select({ slug: books.slug, domain: books.domain, domainVerifiedAt: books.domainVerifiedAt })
        .from(bookSlugs)
        .innerJoin(books, eq(books.id, bookSlugs.bookId))
        .where(eq(bookSlugs.oldSlug, label))
        .get();
      if (renamed) {
        const url = new URL(c.req.url);
        return c.redirect(publicOrigin(config, renamed) + url.pathname + url.search, 301);
      }
      return page(c, 404, "No book here", "There is no book at this address.");
    }

    // A book with an active custom domain lives there only, so students'
    // local state and login stay on one origin. The API keeps answering
    // here: a redirect would turn its POSTs into GETs.
    const method = c.req.method;
    if (
      !c.env.customDomain &&
      activeDomain(book) &&
      (method === "GET" || method === "HEAD") &&
      !c.req.path.startsWith("/_hyperbook/api/")
    ) {
      const url = new URL(c.req.url);
      return c.redirect(publicOrigin(config, book) + url.pathname + url.search, 301);
    }

    c.set("book", book);
    const bearer = c.req.header("authorization")?.match(/^Bearer (\S+)$/)?.[1];
    const cookie = getCookie(c, STUDENT_COOKIE, "host");
    c.set(
      "student",
      bearer
        ? readStudentSession(db, bearer, "token", book.id)
        : cookie
          ? readStudentSession(db, cookie, "cookie", book.id)
          : null,
    );
    await next();
  });

  app.route("/_hyperbook/api", studentApi(deps));

  // Element runtimes the platform extracted once per Hyperbook version (see
  // hosting/runtimes.ts): the public bytes a CDN would serve, so every book
  // host answers them without a login, immutable behind their versioned
  // address. Builds link here instead of copying ~500 MB into every book.
  app.on(["GET", "HEAD"], "/_hyperbook/assets/*", (c) =>
    serveSharedAssets(c, config, new URL(c.req.url).pathname),
  );

  app.get("/_hyperbook/login", (c) => {
    const book = c.get("book");
    c.header("cache-control", "no-store");
    const settings = getInstanceSettings(db);
    // The platform's own pages live on the admin origin.
    const absolute = (href: string) => (href.startsWith("/") ? config.adminOrigin + href : href);
    return c.html(
      loginPage(book.title, book.visibility === "private", {
        imprint: absolute(legalHref(settings, "imprint")),
        privacy: absolute(legalHref(settings, "privacy")),
      }),
    );
  });

  app.get("/_hyperbook/impersonate", (c) => {
    c.header("cache-control", "no-store");
    return c.html(impersonatePage(c.get("book").title));
  });

  app.on(["GET", "HEAD"], "*", async (c) => {
    const book = c.get("book");

    if (book.source === "external" && book.externalUrl) {
      const href = escapeHtml(book.externalUrl);
      return page(c, 404, escapeHtml(book.title), `This book is hosted at <a href="${href}">${href}</a>.`);
    }
    if (book.publishedBuildId === null) {
      return page(c, 404, escapeHtml(book.title), "This book is not published yet.");
    }

    const pathname = new URL(c.req.url).pathname;
    const segments = pathSegments(pathname);
    if (segments === null) return c.text("Bad path", 400);
    if (segments[0] === PLATFORM_PREFIX) return c.text("Not found", 404);

    // Private books are for their students only (or a teacher viewing one).
    const isPrivate = book.visibility === "private";
    if (isPrivate && !c.get("student")) {
      const next = pathname + new URL(c.req.url).search;
      return c.redirect(`/_hyperbook/login?next=${encodeURIComponent(next)}`, 302);
    }

    return serveBuild(c, {
      root: buildDir(config, book.id, book.publishedBuildId),
      pathname,
      segments,
      etag: String(book.publishedBuildId),
      cacheControl: isPrivate ? "private, no-cache" : "no-cache",
    });
  });

  app.all("*", (c) => c.text("Method not allowed", 405, { allow: "GET, HEAD" }));

  return app;
}
