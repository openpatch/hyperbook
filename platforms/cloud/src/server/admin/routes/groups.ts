import { asc, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  createStudentInput,
  generateStudentsInput,
  groupInput,
  resetStudentPasswordInput,
  updateStudentInput,
} from "../../../shared/schemas";
import { audit } from "../../audit";
import {
  createImpersonationCode,
  createStudentSession,
  deleteSessionsOfStudent,
} from "../../auth/student-sessions";
import { publicOrigin } from "../../domain/custom-domains";
import { lastSavedAt, readState } from "../../store/store";
import { open } from "../../crypto/sealed";
import { books, groups, students } from "../../db/schema";
import type { Deps } from "../../deps";
import { bookAccess } from "../../domain/books";
import {
  generatedStudentPassword,
  groupAccess,
  loginKeyFields,
  loginUrl,
  nextUsernames,
  passwordFields,
  publicStudent,
  studentAccess,
  usernameTaken,
} from "../../domain/students";
import type { AuthedEnv } from "../env";
import { requireUser } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";

function isUniqueViolation(error: unknown) {
  return error instanceof Error && /UNIQUE constraint failed/.test(error.message);
}

/** /api/books/:id/groups */
export function bookGroupRoutes({ db }: Deps) {
  return new Hono<AuthedEnv>()
    .use(requireUser)
    .get("/:id/groups", idParam, (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      const rows = db
        .select({
          id: groups.id,
          name: groups.name,
          createdAt: groups.createdAt,
          studentCount: count(students.id),
        })
        .from(groups)
        .leftJoin(students, eq(students.groupId, groups.id))
        .where(eq(groups.bookId, book.id))
        .groupBy(groups.id)
        .orderBy(asc(groups.name))
        .all();
      return c.json(rows.map((g) => ({ ...g, createdAt: g.createdAt.getTime() })));
    })

    .post("/:id/groups", idParam, validate("json", groupInput), (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id);
      const { name } = c.req.valid("json");
      try {
        const group = db.insert(groups).values({ bookId: book.id, name }).returning().get();
        audit(db, {
          actorUserId: user.id,
          action: "group.create",
          targetType: "group",
          targetId: group.id,
          data: { bookId: book.id, name },
        });
        return c.json({ id: group.id, name: group.name, createdAt: group.createdAt.getTime() });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new HTTPException(409, { message: "This book has a group with this name already" });
        }
        throw error;
      }
    });
}

/** /api/groups */
export function groupRoutes({ db, config }: Deps) {
  return new Hono<AuthedEnv>()
    .use(requireUser)

    .get("/:id", idParam, (c) => {
      const { group, book, role } = groupAccess(db, c.get("user"), c.req.valid("param").id);
      return c.json({
        id: group.id,
        name: group.name,
        book: { id: book.id, title: book.title, slug: book.slug, role },
      });
    })

    .patch("/:id", idParam, validate("json", groupInput), (c) => {
      const user = c.get("user");
      const { group } = groupAccess(db, user, c.req.valid("param").id);
      const { name } = c.req.valid("json");
      try {
        db.update(groups).set({ name }).where(eq(groups.id, group.id)).run();
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new HTTPException(409, { message: "This book has a group with this name already" });
        }
        throw error;
      }
      audit(db, {
        actorUserId: user.id,
        action: "group.rename",
        targetType: "group",
        targetId: group.id,
        data: { name },
      });
      return c.json({ ok: true as const });
    })

    .delete("/:id", idParam, (c) => {
      const user = c.get("user");
      const { group } = groupAccess(db, user, c.req.valid("param").id);
      db.delete(groups).where(eq(groups.id, group.id)).run();
      audit(db, {
        actorUserId: user.id,
        action: "group.delete",
        targetType: "group",
        targetId: group.id,
        data: { bookId: group.bookId, name: group.name },
      });
      return c.json({ ok: true as const });
    })

    .get("/:id/students", idParam, (c) => {
      const { group } = groupAccess(db, c.get("user"), c.req.valid("param").id);
      const rows = db
        .select()
        .from(students)
        .where(eq(students.groupId, group.id))
        .orderBy(asc(students.username))
        .all();
      return c.json(rows.map((row) => ({ ...publicStudent(row), lastSavedAt: lastSavedAt(db, row.id) })));
    })

    .post("/:id/students", idParam, validate("json", createStudentInput), async (c) => {
      const user = c.get("user");
      const { group } = groupAccess(db, user, c.req.valid("param").id);
      const input = c.req.valid("json");
      if (usernameTaken(db, group.bookId, input.username)) {
        throw new HTTPException(409, { message: "This book has a student with this username already" });
      }
      const row = db
        .insert(students)
        .values({
          bookId: group.bookId,
          groupId: group.id,
          username: input.username,
          ...(await passwordFields(config, input.password ?? generatedStudentPassword())),
          ...loginKeyFields(config),
        })
        .returning()
        .get();
      audit(db, {
        actorUserId: user.id,
        action: "student.create",
        targetType: "student",
        targetId: row.id,
        data: { groupId: group.id, username: row.username },
      });
      return c.json(publicStudent(row));
    })

    .post(
      "/:id/students/generate",
      idParam,
      validate("json", generateStudentsInput),
      async (c) => {
        const user = c.get("user");
        const { group } = groupAccess(db, user, c.req.valid("param").id);
        const { count: n, prefix, passwordLength } = c.req.valid("json");
        const existing = db
          .select({ username: students.username })
          .from(students)
          .where(eq(students.bookId, group.bookId))
          .all()
          .map((s) => s.username);
        const usernames = nextUsernames(existing, prefix || "student", n);
        // Hash first (slow, async), then insert in one transaction.
        const values = await Promise.all(
          usernames.map(async (username) => ({
            bookId: group.bookId,
            groupId: group.id,
            username,
            ...(await passwordFields(config, generatedStudentPassword(passwordLength))),
            ...loginKeyFields(config),
          })),
        );
        const rows = db.transaction((tx) =>
          values.map((v) => tx.insert(students).values(v).returning().get()),
        );
        audit(db, {
          actorUserId: user.id,
          action: "student.generate",
          targetType: "group",
          targetId: group.id,
          data: { count: rows.length, first: usernames[0], last: usernames.at(-1) },
        });
        return c.json(rows.map(publicStudent));
      },
    )

    .post("/:id/login-keys/regenerate", idParam, (c) => {
      const user = c.get("user");
      const { group } = groupAccess(db, user, c.req.valid("param").id);
      const ids = db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.groupId, group.id))
        .all();
      db.transaction((tx) => {
        for (const { id } of ids) {
          tx.update(students).set(loginKeyFields(config)).where(eq(students.id, id)).run();
        }
      });
      audit(db, {
        actorUserId: user.id,
        action: "student.login-keys.regenerate",
        targetType: "group",
        targetId: group.id,
        data: { count: ids.length },
      });
      return c.json({ count: ids.length });
    })

    .get("/:id/credentials", idParam, (c) => {
      const user = c.get("user");
      const { group, book } = groupAccess(db, user, c.req.valid("param").id);
      const rows = db
        .select()
        .from(students)
        .where(eq(students.groupId, group.id))
        .orderBy(asc(students.username))
        .all();
      const credentials = rows.map((s) => {
        const password = open(config.credentialsKey, s.passwordSealed);
        const loginKey = open(config.credentialsKey, s.loginKeySealed);
        return {
          id: s.id,
          username: s.username,
          // null when CREDENTIALS_KEY changed since: the value cannot be shown
          // any more, but a reset gives a new one.
          password,
          loginUrl: loginKey ? loginUrl(config, book, loginKey) : null,
        };
      });
      audit(db, {
        actorUserId: user.id,
        action: "student.credentials.view",
        targetType: "group",
        targetId: group.id,
        data: { count: credentials.length },
      });
      return c.json({
        book: { id: book.id, title: book.title, slug: book.slug },
        group: { id: group.id, name: group.name },
        loginAddress: publicOrigin(config, book),
        students: credentials,
      });
    });
}

/** /api/students */
export function studentRoutes({ db, config }: Deps) {
  return new Hono<AuthedEnv>()
    .use(requireUser)

    .patch("/:id", idParam, validate("json", updateStudentInput), (c) => {
      const user = c.get("user");
      const { student } = studentAccess(db, user, c.req.valid("param").id);
      const changes = c.req.valid("json");
      if (changes.username !== undefined && usernameTaken(db, student.bookId, changes.username, student.id)) {
        throw new HTTPException(409, { message: "This book has a student with this username already" });
      }
      if (changes.groupId !== undefined) {
        const target = db.select().from(groups).where(eq(groups.id, changes.groupId)).get();
        if (!target || target.bookId !== student.bookId) {
          throw new HTTPException(400, { message: "Students can only move between groups of the same book" });
        }
      }
      const row = db
        .update(students)
        .set({ username: changes.username, groupId: changes.groupId })
        .where(eq(students.id, student.id))
        .returning()
        .get();
      audit(db, {
        actorUserId: user.id,
        action: "student.update",
        targetType: "student",
        targetId: student.id,
        data: changes,
      });
      return c.json(publicStudent(row));
    })

    .put("/:id/password", idParam, validate("json", resetStudentPasswordInput), async (c) => {
      const user = c.get("user");
      const { student } = studentAccess(db, user, c.req.valid("param").id);
      const input = c.req.valid("json");
      const password = input.password ?? generatedStudentPassword();
      db.update(students)
        .set(await passwordFields(config, password))
        .where(eq(students.id, student.id))
        .run();
      // Whoever knew the old password is logged out.
      deleteSessionsOfStudent(db, student.id);
      audit(db, {
        actorUserId: user.id,
        action: "student.password.reset",
        targetType: "student",
        targetId: student.id,
      });
      return c.json({ password });
    })

    // "View as student": a read-only session in the student's book. The
    // browser carries a one-time code (hosted books) or a short-lived token
    // (books hosted elsewhere) there in the address's fragment.
    .post("/:id/impersonate", idParam, (c) => {
      const user = c.get("user");
      const { student } = studentAccess(db, user, c.req.valid("param").id);
      const book = db.select().from(books).where(eq(books.id, student.bookId)).get()!;
      let url: string;
      if (book.source === "external" && book.externalUrl) {
        const token = createStudentSession(db, {
          studentId: student.id,
          kind: "token",
          persistent: false,
          readonly: true,
          impersonatedBy: user.id,
        });
        url = `${book.externalUrl.replace(/#.*$/, "")}#hyperbook-impersonate=${token}`;
      } else {
        const code = createImpersonationCode(db, student.id, user.id);
        url = `${publicOrigin(config, book)}/_hyperbook/impersonate#c=${code}`;
      }
      audit(db, {
        actorUserId: user.id,
        action: "student.impersonate",
        targetType: "student",
        targetId: student.id,
      });
      return c.json({ url });
    })

    .get("/:id/data", idParam, (c) => {
      const user = c.get("user");
      const { student } = studentAccess(db, user, c.req.valid("param").id);
      const state = readState(db, student.id);
      audit(db, {
        actorUserId: user.id,
        action: "student.data.download",
        targetType: "student",
        targetId: student.id,
      });
      c.header("content-disposition", `attachment; filename="${student.username}.json"`);
      return c.json({ username: student.username, ...state });
    })

    .post("/:id/login-key/regenerate", idParam, (c) => {
      const user = c.get("user");
      const { student } = studentAccess(db, user, c.req.valid("param").id);
      db.update(students).set(loginKeyFields(config)).where(eq(students.id, student.id)).run();
      // A new key usually means a lost card: whoever used it is logged out.
      deleteSessionsOfStudent(db, student.id);
      audit(db, {
        actorUserId: user.id,
        action: "student.login-key.regenerate",
        targetType: "student",
        targetId: student.id,
      });
      return c.json({ ok: true as const });
    })

    .delete("/:id", idParam, (c) => {
      const user = c.get("user");
      const { student } = studentAccess(db, user, c.req.valid("param").id);
      db.delete(students).where(eq(students.id, student.id)).run();
      audit(db, {
        actorUserId: user.id,
        action: "student.delete",
        targetType: "student",
        targetId: student.id,
        data: { username: student.username },
      });
      return c.json({ ok: true as const });
    });
}
