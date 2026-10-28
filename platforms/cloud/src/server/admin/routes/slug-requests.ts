import { and, asc, desc, eq, isNotNull, ne } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { slugDecisionInput, slugRequestInput } from "../../../shared/schemas";
import { audit } from "../../audit";
import { bookMembers, books, slugRequests, users } from "../../db/schema";
import type { Deps } from "../../deps";
import { type BookRow, assertSlugAvailable, bookAccess, renameSlug } from "../../domain/books";
import { publicOrigin } from "../../domain/custom-domains";
import { getInstanceSettings } from "../../domain/instance";
import { newSlugSuffix, withSuffix } from "../../domain/slug-names";
import type { AuthedEnv } from "../env";
import { requireAdmin, requireUser } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";

/*
 * In suffix mode, addresses without a suffix (physik instead of physik-edac)
 * are given by admins: a book's owner asks, an admin looks at the book and
 * approves or declines, and may take a granted address back later.
 */

type RequestRow = typeof slugRequests.$inferSelect;

function publicRequest(row: RequestRow) {
  return {
    id: row.id,
    slug: row.slug,
    description: row.description,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt.getTime(),
    decidedAt: row.decidedAt?.getTime() ?? null,
  };
}

function useMail({ db, config, mailer }: Deps) {
  const send = async (to: string, subject: string, text: string) => {
    if (!mailer.enabled) return;
    try {
      await mailer.send({ to, subject, text });
    } catch (error) {
      console.error(`Sending "${subject}" failed:`, error);
    }
  };
  const ownersOf = (bookId: number) =>
    db
      .select({ email: users.email })
      .from(bookMembers)
      .innerJoin(users, eq(users.id, bookMembers.userId))
      .where(and(eq(bookMembers.bookId, bookId), eq(bookMembers.role, "owner")))
      .all();
  const admins = () => db.select({ email: users.email }).from(users).where(eq(users.role, "admin")).all();
  const name = () => getInstanceSettings(db).name;
  const noteText = (note: string) => (note ? `\n\nNote from the admin:\n${note}` : "");
  const bookPage = (bookId: number) => `${config.adminOrigin}/books/${bookId}`;

  return {
    async requested(book: BookRow, request: RequestRow, by: string) {
      for (const admin of admins()) {
        await send(
          admin.email,
          `${request.slug}: address requested for “${book.title}”`,
          `${by} asks for the address ${request.slug} for “${book.title}” at ${name()}, now at ${publicOrigin(config, book)}.\n\n${request.description}\n\nDecide at ${config.adminOrigin}/addresses`,
        );
      }
    },
    async approved(book: BookRow, request: RequestRow) {
      for (const owner of ownersOf(book.id)) {
        await send(
          owner.email,
          `“${book.title}” is now at ${request.slug}`,
          `An admin at ${name()} gave “${book.title}” the address you asked for: ${publicOrigin(config, book)}\n\nThe old address redirects there.${noteText(request.note)}`,
        );
      }
    },
    async declined(book: BookRow, request: RequestRow) {
      for (const owner of ownersOf(book.id)) {
        await send(
          owner.email,
          `Address ${request.slug} for “${book.title}”`,
          `An admin at ${name()} did not give “${book.title}” the address ${request.slug}. The book stays at ${publicOrigin(config, book)}.${noteText(request.note)}\n\n${bookPage(book.id)}`,
        );
      }
    },
    async revoked(book: BookRow, oldSlug: string, note: string) {
      for (const owner of ownersOf(book.id)) {
        await send(
          owner.email,
          `“${book.title}” moved to ${book.slug}`,
          `An admin at ${name()} took back the address ${oldSlug} from “${book.title}”. The book is now at ${publicOrigin(config, book)}; the old address redirects there until it is given to another book.${noteText(note)}`,
        );
      }
    },
  };
}

/** Under /books: asking for an address, and taking one back. */
export function bookSlugRequestRoutes(deps: Deps) {
  const { db } = deps;
  const mail = useMail(deps);

  return new Hono<AuthedEnv>()
    .use(requireUser)

    // The open request, or else the last decision.
    .get("/:id/slug-request", idParam, (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      const row = db
        .select()
        .from(slugRequests)
        .where(and(eq(slugRequests.bookId, book.id), ne(slugRequests.status, "withdrawn")))
        .orderBy(desc(slugRequests.id))
        .get();
      return c.json(row ? publicRequest(row) : null);
    })

    .post("/:id/slug-request", idParam, validate("json", slugRequestInput), async (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id, "owner");
      const input = c.req.valid("json");
      if (!getInstanceSettings(db).slugSuffix) {
        throw new HTTPException(400, { message: "Choose the address in the book's settings" });
      }
      if (book.slugGrantedAt) {
        throw new HTTPException(409, { message: "An admin gave this book its address already" });
      }
      if (input.slug === book.slug) throw new HTTPException(400, { message: "The book has this address already" });
      assertSlugAvailable(db, input.slug, book.id);

      const request = db.transaction((tx) => {
        tx.update(slugRequests)
          .set({ status: "withdrawn" })
          .where(and(eq(slugRequests.bookId, book.id), eq(slugRequests.status, "pending")))
          .run();
        return tx
          .insert(slugRequests)
          .values({ bookId: book.id, slug: input.slug, description: input.description, requestedBy: user.id })
          .returning()
          .get();
      });
      audit(db, {
        actorUserId: user.id,
        action: "book.slug.request",
        targetType: "book",
        targetId: book.id,
        data: { slug: input.slug },
      });
      await mail.requested(book, request, user.displayName || user.email);
      return c.json(publicRequest(request));
    })

    .delete("/:id/slug-request", idParam, (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id, "owner");
      const withdrawn = db
        .update(slugRequests)
        .set({ status: "withdrawn" })
        .where(and(eq(slugRequests.bookId, book.id), eq(slugRequests.status, "pending")))
        .returning()
        .all();
      if (withdrawn.length > 0) {
        audit(db, {
          actorUserId: user.id,
          action: "book.slug.withdraw",
          targetType: "book",
          targetId: book.id,
          data: { slug: withdrawn[0]!.slug },
        });
      }
      return c.json({ ok: true as const });
    })

    // Back to <name>-<suffix>; the freed address redirects until it is given away.
    .post("/:id/slug/revoke", requireAdmin, idParam, validate("json", slugDecisionInput), async (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id, "owner");
      const { note } = c.req.valid("json");
      if (!book.slugGrantedAt) throw new HTTPException(409, { message: "This book has no granted address" });
      const suffix = book.slugSuffix ?? newSlugSuffix();
      const slug = withSuffix(book.slug, suffix);
      assertSlugAvailable(db, slug, book.id);
      renameSlug(db, book, slug);
      db.update(books)
        .set({ slugSuffix: suffix, slugGrantedAt: null, slugGrantedBy: null })
        .where(eq(books.id, book.id))
        .run();
      audit(db, {
        actorUserId: user.id,
        action: "book.slug.revoke",
        targetType: "book",
        targetId: book.id,
        data: { from: book.slug, to: slug, note },
      });
      const updated = db.select().from(books).where(eq(books.id, book.id)).get()!;
      await mail.revoked(updated, book.slug, note);
      return c.json({ ok: true as const, slug });
    });
}

/** Under /slug-requests, for admins: what is asked for, and what was granted. */
export function slugRequestRoutes(deps: Deps) {
  const { db, config } = deps;
  const mail = useMail(deps);

  const pending = (id: number) => {
    const request = db.select().from(slugRequests).where(eq(slugRequests.id, id)).get();
    if (!request) throw new HTTPException(404, { message: "Request not found" });
    if (request.status !== "pending") throw new HTTPException(409, { message: "This request was decided already" });
    const book = db.select().from(books).where(eq(books.id, request.bookId)).get()!;
    return { request, book };
  };

  return new Hono<AuthedEnv>()
    .use(requireAdmin)

    .get("/", (c) => {
      const open = db
        .select({ request: slugRequests, book: books, email: users.email, displayName: users.displayName })
        .from(slugRequests)
        .innerJoin(books, eq(books.id, slugRequests.bookId))
        .leftJoin(users, eq(users.id, slugRequests.requestedBy))
        .where(eq(slugRequests.status, "pending"))
        .orderBy(asc(slugRequests.id))
        .all();
      const granted = db.select().from(books).where(isNotNull(books.slugGrantedAt)).orderBy(books.slug).all();
      return c.json({
        pending: open.map(({ request, book, email, displayName }) => {
          const holder = db.select({ id: books.id, title: books.title }).from(books).where(eq(books.slug, request.slug)).get();
          return {
            ...publicRequest(request),
            book: { id: book.id, title: book.title, slug: book.slug, url: publicOrigin(config, book) },
            requestedBy: email ? { email, displayName: displayName ?? "" } : null,
            /** Another book that has the address now; approving fails until it is free. */
            takenBy: holder && holder.id !== book.id ? holder : null,
          };
        }),
        granted: granted.map((book) => ({
          id: book.id,
          title: book.title,
          slug: book.slug,
          url: publicOrigin(config, book),
          grantedAt: book.slugGrantedAt!.getTime(),
        })),
      });
    })

    .post("/:id/approve", idParam, validate("json", slugDecisionInput), async (c) => {
      const user = c.get("user");
      const { request, book } = pending(c.req.valid("param").id);
      const { note } = c.req.valid("json");
      assertSlugAvailable(db, request.slug, book.id);
      renameSlug(db, book, request.slug);
      const now = new Date();
      const others = db.transaction((tx) => {
        tx.update(books)
          .set({ slugSuffix: book.slugSuffix ?? newSlugSuffix(), slugGrantedAt: now, slugGrantedBy: user.id })
          .where(eq(books.id, book.id))
          .run();
        tx.update(slugRequests)
          .set({ status: "approved", decidedBy: user.id, decidedAt: now, note })
          .where(eq(slugRequests.id, request.id))
          .run();
        // Other books asking for the same address cannot get it now.
        return tx
          .update(slugRequests)
          .set({
            status: "declined",
            decidedBy: user.id,
            decidedAt: now,
            note: "The address was given to another book.",
          })
          .where(and(eq(slugRequests.slug, request.slug), eq(slugRequests.status, "pending")))
          .returning()
          .all();
      });
      audit(db, {
        actorUserId: user.id,
        action: "book.slug.approve",
        targetType: "book",
        targetId: book.id,
        data: { from: book.slug, to: request.slug },
      });
      const updated = db.select().from(books).where(eq(books.id, book.id)).get()!;
      await mail.approved(updated, { ...request, note });
      for (const other of others) {
        const otherBook = db.select().from(books).where(eq(books.id, other.bookId)).get();
        if (otherBook) await mail.declined(otherBook, other);
      }
      return c.json({ ok: true as const });
    })

    .post("/:id/decline", idParam, validate("json", slugDecisionInput), async (c) => {
      const user = c.get("user");
      const { request, book } = pending(c.req.valid("param").id);
      const { note } = c.req.valid("json");
      const declined = db
        .update(slugRequests)
        .set({ status: "declined", decidedBy: user.id, decidedAt: new Date(), note })
        .where(eq(slugRequests.id, request.id))
        .returning()
        .get();
      audit(db, {
        actorUserId: user.id,
        action: "book.slug.decline",
        targetType: "book",
        targetId: book.id,
        data: { slug: request.slug, note },
      });
      await mail.declined(book, declined);
      return c.json({ ok: true as const });
    });
}
