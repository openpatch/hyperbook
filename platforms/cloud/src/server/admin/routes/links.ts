import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { createLinkInput, redeemLinkInput } from "../../../shared/schemas";
import { audit } from "../../audit";
import { OpLimiter } from "../../auth/rate-limit";
import { bookLinks, books } from "../../db/schema";
import type { Deps } from "../../deps";
import { bookAccess } from "../../domain/books";
import {
  createLink,
  deleteLinkSession,
  isLive,
  liveLinks,
  publicLink,
  redeemLink,
  revealLink,
  revokeLink,
} from "../../domain/links";
import { createT } from "../../i18n";
import type { AdminEnv, AuthedEnv } from "../env";
import { clearLinkCookie, requireUser, setLinkCookie } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";

const linkParam = validate(
  "param",
  z.object({
    id: z.coerce.number().int().positive(),
    linkId: z.coerce.number().int().positive(),
  }),
);

/**
 * /api/links: the visitor's side of an access link. Opening one, who it
 * says they are, and leaving.
 */
export function linkRoutes({ db }: Deps) {
  // Tokens are 256 random bits, so guessing is hopeless; this only keeps a
  // flood of redeem calls from reaching the database.
  const redeems = new OpLimiter(300, 60 * 1000);
  return new Hono<AdminEnv>()
    .post("/redeem", validate("json", redeemLinkInput), (c) => {
      const t = createT(c.get("locale"));
      if (redeems.isBlocked("all")) throw new HTTPException(429, { message: t("links.tooMany") });
      redeems.hit("all");
      const redeemed = redeemLink(db, c.req.valid("json").token);
      // The same answer for unknown, deleted and expired links: an old link
      // tells nothing about the book.
      if (!redeemed) throw new HTTPException(404, { message: t("links.gone") });
      setLinkCookie(c, redeemed.sessionToken);
      return c.json({ bookId: redeemed.link.bookId, role: redeemed.link.role, name: redeemed.link.name });
    })

    // Who the link session is, for the editor's shell; null without one.
    .get("/session", (c) => {
      const link = c.get("link");
      if (!link) return c.json(null);
      const book = db.select({ title: books.title }).from(books).where(eq(books.id, link.bookId)).get();
      return c.json({ bookId: link.bookId, bookTitle: book?.title ?? "", name: link.name, role: link.role });
    })

    .post("/leave", (c) => {
      const link = c.get("link");
      if (link) deleteLinkSession(db, link.idHash);
      clearLinkCookie(c);
      return c.json({ ok: true as const });
    });
}

/** /api/books/:id/links: the owners' list of a book's access links. */
export function bookLinkRoutes({ db, config }: Deps) {
  return new Hono<AuthedEnv>()
    .use(requireUser)

    .get("/:id/links", idParam, (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id, "owner");
      return c.json(liveLinks(db, book.id).map(publicLink));
    })

    .post("/:id/links", idParam, validate("json", createLinkInput), (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id, "owner");
      const input = c.req.valid("json");
      if (input.expiresAt !== null && input.expiresAt <= Date.now()) {
        throw new HTTPException(400, { message: createT(c.get("locale"))("links.expiryPast") });
      }
      const { link, url } = createLink(db, config, {
        bookId: book.id,
        name: input.name,
        role: input.role,
        expiresAt: input.expiresAt === null ? null : new Date(input.expiresAt),
        createdBy: user.id,
      });
      audit(db, {
        actorUserId: user.id,
        action: "book.link.create",
        targetType: "book",
        targetId: book.id,
        data: { linkId: link.id, name: link.name, role: link.role },
      });
      return c.json({ ...publicLink(link), url });
    })

    // The link again, to copy it; viewing it is audited like credentials.
    .get("/:id/links/:linkId/url", linkParam, (c) => {
      const user = c.get("user");
      const { id, linkId } = c.req.valid("param");
      const { book } = bookAccess(db, user, id, "owner");
      const link = db
        .select()
        .from(bookLinks)
        .where(and(eq(bookLinks.id, linkId), eq(bookLinks.bookId, book.id)))
        .get();
      const t = createT(c.get("locale"));
      if (!link || !isLive(link)) throw new HTTPException(404, { message: t("links.gone") });
      const url = revealLink(config, link);
      if (!url) throw new HTTPException(409, { message: t("links.keyChanged") });
      audit(db, {
        actorUserId: user.id,
        action: "book.link.view",
        targetType: "book",
        targetId: book.id,
        data: { linkId: link.id },
      });
      return c.json({ url });
    })

    .delete("/:id/links/:linkId", linkParam, (c) => {
      const user = c.get("user");
      const { id, linkId } = c.req.valid("param");
      const { book } = bookAccess(db, user, id, "owner");
      const link = db
        .select()
        .from(bookLinks)
        .where(and(eq(bookLinks.id, linkId), eq(bookLinks.bookId, book.id)))
        .get();
      if (!link) throw new HTTPException(404, { message: createT(c.get("locale"))("links.gone") });
      revokeLink(db, link.id);
      audit(db, {
        actorUserId: user.id,
        action: "book.link.delete",
        targetType: "book",
        targetId: book.id,
        data: { linkId: link.id, name: link.name },
      });
      return c.json({ ok: true as const });
    });
}
