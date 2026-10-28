import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import {
  addMemberInput,
  bookDomainInput,
  createBookInput,
  updateBookInput,
  updateMemberInput,
} from "../../../shared/schemas";
import { audit } from "../../audit";
import { bookMembers, bookSlugs, books, users } from "../../db/schema";
import type { Deps } from "../../deps";
import {
  type BookRow,
  assertSlugAvailable,
  bookAccess,
  ownedBookCount,
  ownerCount,
  publicBook,
  renameSlug,
} from "../../domain/books";
import { checkDomain, domainNameProblem } from "../../domain/custom-domains";
import { getEntitlements } from "../../domain/entitlements";
import { newSlugSuffix, suffixApplies, withSuffix } from "../../domain/slug-names";
import { removeBookFiles } from "../../hosting/storage";
import type { AuthedEnv } from "../env";
import { requireUser } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";

const memberParam = validate(
  "param",
  z.object({
    id: z.coerce.number().int().positive(),
    userId: z.coerce.number().int().positive(),
  }),
);

export function bookRoutes({ db, config, builds, dns }: Deps) {
  function members(bookId: number) {
    return db
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        role: bookMembers.role,
      })
      .from(bookMembers)
      .innerJoin(users, eq(users.id, bookMembers.userId))
      .where(eq(bookMembers.bookId, bookId))
      .orderBy(users.email)
      .all();
  }

  /** Checks the book's domain, stores the outcome, and activates it if it passed. */
  async function check(book: BookRow, actorUserId: number) {
    const { problem } = await checkDomain(db, dns, config, book);
    const activate = problem === null && book.domainVerifiedAt === null;
    try {
      db.update(books)
        .set({
          domainCheckedAt: new Date(),
          domainProblem: problem,
          ...(activate && { domainVerifiedAt: new Date() }),
        })
        // The domain may have changed while DNS was asked.
        .where(and(eq(books.id, book.id), eq(books.domain, book.domain!)))
        .run();
    } catch {
      // Another book activated the same domain in the meantime.
      db.update(books)
        .set({ domainCheckedAt: new Date(), domainProblem: "Another book uses this domain already." })
        .where(eq(books.id, book.id))
        .run();
      return;
    }
    if (activate) {
      audit(db, {
        actorUserId,
        action: "book.domain.activate",
        targetType: "book",
        targetId: book.id,
        data: { domain: book.domain },
      });
    }
  }

  function reload(bookId: number) {
    return db.select().from(books).where(eq(books.id, bookId)).get()!;
  }

  return new Hono<AuthedEnv>()
    .use(requireUser)

    .get("/", (c) => {
      const user = c.get("user");
      const rows =
        user.role === "admin"
          ? db.select().from(books).orderBy(books.title).all().map((book) => ({
              book,
              role: "owner" as const,
            }))
          : db
              .select({ book: books, role: bookMembers.role })
              .from(bookMembers)
              .innerJoin(books, eq(books.id, bookMembers.bookId))
              .where(eq(bookMembers.userId, user.id))
              .orderBy(books.title)
              .all();
      return c.json(rows.map(({ book, role }) => publicBook(config, book, role)));
    })

    .post("/", validate("json", createBookInput), (c) => {
      const user = c.get("user");
      const input = c.req.valid("json");
      const { max_books } = getEntitlements(db, user);
      if (max_books !== null && ownedBookCount(db, user.id) >= max_books) {
        throw new HTTPException(403, {
          message: `You may own at most ${max_books} book(s). Delete one or ask an admin for more.`,
        });
      }
      // In suffix mode, a new suffix for each try: another book may hold the address.
      let slug = input.slug;
      let slugSuffix: string | null = null;
      for (let attempt = 0; ; attempt++) {
        if (suffixApplies(db, user)) {
          slugSuffix = newSlugSuffix();
          slug = withSuffix(input.slug, slugSuffix);
        }
        try {
          assertSlugAvailable(db, slug, null);
          break;
        } catch (error) {
          if (!slugSuffix || attempt >= 4 || !(error instanceof HTTPException) || error.status !== 409) throw error;
        }
      }
      const book = db.transaction((tx) => {
        const created = tx
          .insert(books)
          .values({
            slug,
            slugSuffix,
            title: input.title,
            description: input.description,
            createdBy: user.id,
          })
          .returning()
          .get();
        tx.insert(bookMembers).values({ bookId: created.id, userId: user.id, role: "owner" }).run();
        // The address may have redirected to a renamed book; it is this one's now.
        tx.delete(bookSlugs).where(eq(bookSlugs.oldSlug, created.slug)).run();
        return created;
      });
      audit(db, {
        actorUserId: user.id,
        action: "book.create",
        targetType: "book",
        targetId: book.id,
        data: { slug: book.slug, title: book.title },
      });
      return c.json(publicBook(config, book, "owner"));
    })

    .get("/:id", idParam, (c) => {
      const { book, role } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      return c.json(publicBook(config, book, role));
    })

    .patch("/:id", idParam, validate("json", updateBookInput), (c) => {
      const user = c.get("user");
      const changes = c.req.valid("json");
      const ownerOnly =
        changes.slug !== undefined ||
        changes.visibility !== undefined ||
        changes.externalUrl !== undefined;
      const { book, role } = bookAccess(
        db,
        user,
        c.req.valid("param").id,
        ownerOnly ? "owner" : "editor",
      );

      if (
        changes.visibility === "private" &&
        book.visibility !== "private" &&
        !getEntitlements(db, user).private_books
      ) {
        throw new HTTPException(403, {
          message: "Your account may not make books private. Ask an admin.",
        });
      }

      if (changes.slug !== undefined && changes.slug !== book.slug) {
        let slug = changes.slug;
        if (suffixApplies(db, user)) {
          if (book.slugGrantedAt) {
            throw new HTTPException(403, {
              message: "An admin gave this book its address. Ask an admin to change it.",
            });
          }
          const suffix = book.slugSuffix ?? newSlugSuffix();
          if (!book.slugSuffix) db.update(books).set({ slugSuffix: suffix }).where(eq(books.id, book.id)).run();
          slug = withSuffix(changes.slug, suffix);
        }
        if (slug !== book.slug) {
          assertSlugAvailable(db, slug, book.id);
          renameSlug(db, book, slug);
        }
      }

      db.update(books)
        .set({
          title: changes.title,
          description: changes.description,
          visibility: changes.visibility,
          ...(changes.externalUrl !== undefined && {
            externalUrl: changes.externalUrl,
            source: changes.externalUrl ? ("external" as const) : ("hosted" as const),
          }),
          updatedAt: new Date(),
        })
        .where(eq(books.id, book.id))
        .run();
      audit(db, {
        actorUserId: user.id,
        action: "book.update",
        targetType: "book",
        targetId: book.id,
        data: changes,
      });
      const updated = db.select().from(books).where(eq(books.id, book.id)).get()!;
      return c.json(publicBook(config, updated, role));
    })

    .delete("/:id", idParam, async (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id, "owner");
      builds.cancelBook(book.id);
      db.delete(books).where(eq(books.id, book.id)).run();
      await removeBookFiles(config, book.id);
      audit(db, {
        actorUserId: user.id,
        action: "book.delete",
        targetType: "book",
        targetId: book.id,
        data: { slug: book.slug, title: book.title },
      });
      return c.json({ ok: true as const });
    })

    .put("/:id/domain", idParam, validate("json", bookDomainInput), async (c) => {
      const user = c.get("user");
      const { book, role } = bookAccess(db, user, c.req.valid("param").id, "owner");
      const { domain } = c.req.valid("json");
      if (book.source !== "hosted") {
        throw new HTTPException(400, { message: "Only books hosted here can have a custom domain" });
      }
      if (!getEntitlements(db, user).custom_domain) {
        throw new HTTPException(403, { message: "Your account may not use custom domains. Ask an admin." });
      }
      const problem = domainNameProblem(config, domain);
      if (problem) throw new HTTPException(400, { message: problem });
      if (domain !== book.domain) {
        db.update(books)
          .set({
            domain,
            domainVerifiedAt: null,
            domainCheckedAt: null,
            domainProblem: null,
            updatedAt: new Date(),
          })
          .where(eq(books.id, book.id))
          .run();
        audit(db, {
          actorUserId: user.id,
          action: "book.domain.set",
          targetType: "book",
          targetId: book.id,
          data: { domain },
        });
        await check(reload(book.id), user.id);
      }
      return c.json(publicBook(config, reload(book.id), role));
    })

    .post("/:id/domain/check", idParam, async (c) => {
      const user = c.get("user");
      const { book, role } = bookAccess(db, user, c.req.valid("param").id, "owner");
      if (!book.domain) throw new HTTPException(404, { message: "This book has no custom domain" });
      await check(book, user.id);
      return c.json(publicBook(config, reload(book.id), role));
    })

    .delete("/:id/domain", idParam, (c) => {
      const user = c.get("user");
      const { book, role } = bookAccess(db, user, c.req.valid("param").id, "owner");
      if (book.domain) {
        db.update(books)
          .set({
            domain: null,
            domainVerifiedAt: null,
            domainCheckedAt: null,
            domainProblem: null,
            updatedAt: new Date(),
          })
          .where(eq(books.id, book.id))
          .run();
        audit(db, {
          actorUserId: user.id,
          action: "book.domain.remove",
          targetType: "book",
          targetId: book.id,
          data: { domain: book.domain },
        });
      }
      return c.json(publicBook(config, reload(book.id), role));
    })

    .get("/:id/members", idParam, (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      return c.json(members(book.id));
    })

    .post("/:id/members", idParam, validate("json", addMemberInput), (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id, "owner");
      const input = c.req.valid("json");
      const member = db.select().from(users).where(eq(users.email, input.email)).get();
      if (!member || member.disabledAt) {
        throw new HTTPException(404, {
          message: "There is no account with this email. Ask an admin to create one.",
        });
      }
      db.insert(bookMembers)
        .values({ bookId: book.id, userId: member.id, role: input.role })
        .onConflictDoUpdate({
          target: [bookMembers.bookId, bookMembers.userId],
          set: { role: input.role },
        })
        .run();
      audit(db, {
        actorUserId: user.id,
        action: "book.member.add",
        targetType: "book",
        targetId: book.id,
        data: { email: member.email, role: input.role },
      });
      return c.json(members(book.id));
    })

    .patch("/:id/members/:userId", memberParam, validate("json", updateMemberInput), (c) => {
      const user = c.get("user");
      const { id, userId } = c.req.valid("param");
      const { role } = c.req.valid("json");
      const { book } = bookAccess(db, user, id, "owner");
      const current = db
        .select()
        .from(bookMembers)
        .where(and(eq(bookMembers.bookId, book.id), eq(bookMembers.userId, userId)))
        .get();
      if (!current) throw new HTTPException(404, { message: "Not a member of this book" });
      if (current.role === "owner" && role !== "owner" && ownerCount(db, book.id) === 1) {
        throw new HTTPException(400, { message: "A book needs at least one owner" });
      }
      db.update(bookMembers)
        .set({ role })
        .where(and(eq(bookMembers.bookId, book.id), eq(bookMembers.userId, userId)))
        .run();
      audit(db, {
        actorUserId: user.id,
        action: "book.member.update",
        targetType: "book",
        targetId: book.id,
        data: { userId, role },
      });
      return c.json(members(book.id));
    })

    .delete("/:id/members/:userId", memberParam, (c) => {
      const user = c.get("user");
      const { id, userId } = c.req.valid("param");
      // Anyone may leave a book; removing others is for owners.
      const { book } = bookAccess(db, user, id, userId === user.id ? "editor" : "owner");
      const current = db
        .select()
        .from(bookMembers)
        .where(and(eq(bookMembers.bookId, book.id), eq(bookMembers.userId, userId)))
        .get();
      if (!current) throw new HTTPException(404, { message: "Not a member of this book" });
      if (current.role === "owner" && ownerCount(db, book.id) === 1) {
        throw new HTTPException(400, { message: "A book needs at least one owner" });
      }
      db.delete(bookMembers)
        .where(and(eq(bookMembers.bookId, book.id), eq(bookMembers.userId, userId)))
        .run();
      audit(db, {
        actorUserId: user.id,
        action: "book.member.remove",
        targetType: "book",
        targetId: book.id,
        data: { userId },
      });
      return c.json(members(book.id));
    });
}
