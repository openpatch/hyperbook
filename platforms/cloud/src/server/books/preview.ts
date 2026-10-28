import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  PREVIEW_SESSION_LIFETIME_MS,
  readPreviewSession,
  redeemPreviewCode,
} from "../auth/preview-sessions";
import { previewOrigin } from "../config";
import { books } from "../db/schema";
import type { Deps } from "../deps";
import type { BookRow } from "../domain/books";
import { RenderError } from "../hosting/renders";
import type { BookBindings } from "./env";
import { previewPage } from "./pages";
import { escapeHtml, page, pathSegments, serveFile } from "./serve";

/** <slug>--preview.<BOOKS_DOMAIN> */
export const PREVIEW_SUFFIX = "--preview";

const PREVIEW_COOKIE = "hb_preview";

/**
 * Keeps the reader's place when the editor reloads the preview after a
 * change: Hyperbook pages scroll in <main>.
 */
const KEEP_SCROLL = `<script>(() => {
  const key = "hb-preview-scroll:" + location.pathname;
  const scroller = () => document.querySelector("main");
  addEventListener("pagehide", () => {
    try { sessionStorage.setItem(key, JSON.stringify([scrollY, scroller()?.scrollTop ?? 0])); } catch {}
  });
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(key)); } catch {}
  if (!saved || location.hash) return;
  const restore = () => { scrollTo(0, saved[0]); const m = scroller(); if (m) m.scrollTop = saved[1]; };
  restore();
  addEventListener("load", restore);
})();</script>`;

type PreviewEnv = {
  Bindings: BookBindings;
  Variables: { book: BookRow; allowed: boolean };
};

/**
 * The preview host of a book: its newest save, pages rendered one by one as
 * they are visited (with the editor's unsaved text of the page it shows), for
 * its owners and editors only. The editor frames it, which makes it a third party there, so the
 * session cookie is SameSite=None and partitioned (CHIPS): browsers that
 * block third-party cookies keep one per top-level site.
 *
 * There is no student API here; books run as if nobody were logged in.
 */
export function createPreviewApp(deps: Deps) {
  const { db, config, renders } = deps;
  const app = new Hono<PreviewEnv>();

  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status);
    console.error(error);
    return c.json({ error: "Something went wrong on the server" }, 500);
  });

  app.use(async (c, next) => {
    const book = db.select().from(books).where(eq(books.slug, c.env.label)).get();
    if (!book || book.source === "external") {
      return page(c, 404, "No preview here", "There is no book at this address.");
    }
    c.set("book", book);
    const token = getCookie(c, PREVIEW_COOKIE, "host");
    c.set("allowed", token ? readPreviewSession(db, token, book.id) : false);
    c.header("x-robots-tag", "noindex");
    await next();
  });

  app.get("/_hyperbook/preview", (c) => {
    c.header("cache-control", "no-store");
    return c.html(previewPage(`${c.get("book").title} (preview)`, config.adminOrigin));
  });

  app.post("/_hyperbook/api/preview", async (c) => {
    const book = c.get("book");
    // Only the hand-off page on this host may log in here.
    if (c.req.header("origin") !== previewOrigin(config, book.slug)) {
      throw new HTTPException(403, { message: "Cross-origin request refused" });
    }
    const body = z.object({ code: z.string().max(200) }).safeParse(await c.req.json().catch(() => null));
    const token = body.success ? redeemPreviewCode(db, body.data.code, book.id) : null;
    if (!token) {
      throw new HTTPException(401, { message: "This link has expired. Open the preview from the editor again." });
    }
    setCookie(c, PREVIEW_COOKIE, token, {
      prefix: "host",
      httpOnly: true,
      sameSite: "None",
      partitioned: true,
      maxAge: Math.floor(PREVIEW_SESSION_LIFETIME_MS / 1000),
    });
    return c.json({ ok: true as const });
  });

  // Lets the hand-off page find out whether the browser kept the cookie.
  app.get("/_hyperbook/api/preview", (c) =>
    c.get("allowed") ? c.json({ ok: true as const }) : c.json({ error: "Not logged in" }, 401),
  );

  app.all("/_hyperbook/*", (c) => c.json({ error: "Not found" }, 404));

  app.on(["GET", "HEAD"], "*", async (c: Context<PreviewEnv>) => {
    const book = c.get("book");
    c.header("cache-control", "private, no-store");
    if (!c.get("allowed")) {
      return page(c, 403, escapeHtml(book.title), "Open the preview from the book's editor.");
    }
    const pathname = new URL(c.req.url).pathname;
    const segments = pathSegments(pathname);
    if (segments === null) return c.text("Bad path", 400);

    try {
      // Pages are rendered as they are visited; files come from the book.
      if (!segments.at(-1)?.includes(".") || pathname.endsWith(".html")) {
        const rendered = await renders.page(book.id, pathname);
        if (rendered && !rendered.render.ok) {
          return page(c, 404, escapeHtml(book.title), `This page could not be shown: ${escapeHtml(rendered.render.error)}`);
        }
        if (rendered?.render.ok) {
          const html = await readFile(path.join(rendered.outDir, rendered.render.out), "utf8");
          const end = html.lastIndexOf("</body>");
          return c.html(end < 0 ? html + KEEP_SCROLL : html.slice(0, end) + KEEP_SCROLL + html.slice(end));
        }
      }
      const roots = await renders.roots(book.id);
      for (const root of roots) {
        const found = await serveFile(c, { root, pathname, segments, etag: "preview", cacheControl: "private, no-store" });
        if (found) return found;
      }
      return page(c, 404, "Page not found", "This page does not exist in the book.");
    } catch (error) {
      if (error instanceof RenderError) return page(c, 404, escapeHtml(book.title), escapeHtml(error.message));
      throw error;
    }
  });

  app.all("*", (c) => c.text("Method not allowed", 405, { allow: "GET, HEAD" }));

  return app;
}
