import { readFile } from "node:fs/promises";
import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { Deps } from "../deps";
import { BLOCKFLOW_CSP, serveBlockflow } from "./blockflow";
import type { AdminEnv } from "./env";
import { requestLocale, createT } from "../i18n";
import { localeMiddleware, originCheck, sessionMiddleware } from "./middleware";
import { aiRoutes, bookAiRoutes } from "./routes/ai";
import { auditRoutes } from "./routes/audit";
import { authRoutes } from "./routes/auth";
import { bookRoutes } from "./routes/books";
import { bookDictionaryRoutes } from "./routes/dictionary";
import { bookFileRoutes } from "./routes/files";
import { gitHttpRoutes, gitTokenRoutes } from "./routes/git";
import { bookGroupRoutes, groupRoutes, studentRoutes } from "./routes/groups";
import { instanceRoutes, publicInstanceRoutes } from "./routes/instance";
import { meRoutes } from "./routes/me";
import { bookPublishingRoutes, buildRoutes } from "./routes/publishing";
import { bookSlugRequestRoutes, slugRequestRoutes } from "./routes/slug-requests";
import { userRoutes } from "./routes/users";

/** The JSON API. Its type drives the web app's typed client. */
export function createAdminApi(deps: Deps) {
  return new Hono<AdminEnv>()
    .use(originCheck(deps))
    .use(sessionMiddleware(deps))
    .use(localeMiddleware(deps))
    .route("/auth", authRoutes(deps))
    // Before /instance, whose admin-only middleware would otherwise run first.
    .route("/instance/public", publicInstanceRoutes(deps))
    .route("/instance", instanceRoutes(deps))
    .route("/me", meRoutes(deps))
    .route("/users", userRoutes(deps))
    .route("/books", bookRoutes(deps))
    .route("/books", gitTokenRoutes(deps))
    .route("/books", bookGroupRoutes(deps))
    .route("/books", bookPublishingRoutes(deps))
    .route("/books", bookFileRoutes(deps))
    .route("/books", bookDictionaryRoutes(deps))
    .route("/books", bookAiRoutes(deps))
    .route("/ai", aiRoutes(deps))
    .route("/books", bookSlugRequestRoutes(deps))
    .route("/slug-requests", slugRequestRoutes(deps))
    .route("/builds", buildRoutes(deps))
    .route("/groups", groupRoutes(deps))
    .route("/students", studentRoutes(deps))
    .route("/audit", auditRoutes(deps));
}

export type AdminApi = ReturnType<typeof createAdminApi>;

/**
 * Everything served on ADMIN_ORIGIN: the JSON API under /api and, in
 * production, the built single-page app. In development Vite serves the app
 * and proxies /api here.
 */
export function createAdminApp(deps: Deps, options: { webRoot?: string } = {}) {
  const app = new Hono();

  // The blockflow editor frame (see blockflow.ts) gets its own CSP — one that
  // allows what scratch-vm needs — and relaxed framing headers: its small stage
  // is a srcdoc/blob iframe, which X-Frame-Options/CORP same-origin block from
  // an opaque origin. CSP frame-ancestors 'self' still keeps others from
  // framing the embed pages. Registered before secureHeaders so it can replace
  // the headers after that middleware set them.
  app.use("/blockflow/*", async (c, next) => {
    await next();
    c.res.headers.set("Content-Security-Policy", BLOCKFLOW_CSP);
    c.res.headers.delete("X-Frame-Options");
    c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  });

  app.use(
    secureHeaders({
      // Only the admin UI itself frames it: the editor runs the elements'
      // visual editors in visual.html, so their CSS stays apart.
      xFrameOptions: "SAMEORIGIN",
      referrerPolicy: "same-origin",
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // Radix positions popovers with inline styles.
        styleSrc: ["'self'", "'unsafe-inline'"],
        // QR codes are inline SVG; data: covers small built-in images, blob:
        // the editor's view of a book's images. Learning maps may show images
        // from anywhere on the web.
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
        // The editor frames the preview host of the book and visual.html.
        frameSrc: ["'self'", `${deps.config.booksProtocol}//*.${deps.config.booksDomain}`],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
      },
    }),
  );

  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      // Some errors carry a body of their own (e.g. the paths of a conflict).
      if (error.res) return error.getResponse();
      return c.json({ error: error.message }, error.status);
    }
    console.error(error);
    return c.json({ error: createT(requestLocale(c))("errors.generic") }, 500);
  });

  // Git smart HTTP lives outside the /api sub-app, so originCheck (which
  // demands JSON) does not apply to it; it has its own token auth instead.
  app.route("/api/books/:id/git", gitHttpRoutes(deps));
  app.route("/api", createAdminApi(deps));
  // A mounted app's notFound handler is not used, so unknown API paths are
  // answered here — otherwise they would fall through to the app shell below.
  app.all("/api/*", (c) => c.json({ error: createT(requestLocale(c))("errors.notFound") }, 404));

  // The blockflow editor bundle, framed by visual.html (same origin). Public
  // bytes, like on the book hosts; the version in the runtime makes them
  // immutable.
  app.on(["GET", "HEAD"], "/blockflow/*", (c) => serveBlockflow(c, deps.config));

  const { webRoot } = options;
  if (webRoot) {
    const indexHtml = path.join(webRoot, "index.html");
    app.use("/*", serveStatic({ root: webRoot }));
    // Client-side routes: every other path gets the app shell.
    app.get("/*", async (c) => c.html(await readFile(indexHtml, "utf8")));
  }

  return app;
}
