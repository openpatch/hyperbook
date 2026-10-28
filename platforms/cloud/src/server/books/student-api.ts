import { and, eq } from "drizzle-orm";
import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { dummyPasswordHash, verifyPassword } from "../auth/password";
import { FailureLimiter } from "../auth/rate-limit";
import {
  READONLY_LIFETIME_MS,
  STUDENT_SESSION_LIFETIME_MS,
  createStudentSession,
  deleteStudentSession,
  redeemImpersonationCode,
} from "../auth/student-sessions";
import { bookOrigin } from "../config";
import { publicOrigin } from "../domain/custom-domains";
import { sha256 } from "../crypto/tokens";
import { students } from "../db/schema";
import type { Deps } from "../deps";
import type { BookRow } from "../domain/books";
import { type Snapshot, type WireEvent, validateEvents } from "../store/replay";
import { StoreTooLargeError, appendEvents, readState, replaceSnapshot } from "../store/store";
import type { BookEnv } from "./env";

/*
 * The API students' books talk to, under /_hyperbook/api on the book's own
 * host:
 *
 * - Hosted books call it same-origin and log in with an HttpOnly cookie.
 * - Books hosted elsewhere (external_url) call it cross-origin with a Bearer
 *   token. CORS admits exactly that one origin, and never with cookies.
 *
 * Books on sibling subdomains count as "same site", so SameSite cookies alone
 * would let one book use another's student session. Every changing request
 * therefore has to come from this book's own origin, or carry a Bearer token.
 */

export const STUDENT_COOKIE = "hb_student";

/** The origin of an external book's own site, which may call the API. */
export function externalOrigin(book: BookRow): string | null {
  if (book.source !== "external" || !book.externalUrl) return null;
  try {
    return new URL(book.externalUrl).origin;
  } catch {
    return null;
  }
}

function setStudentCookie(c: Context, token: string, maxAgeMs: number | null) {
  setCookie(c, STUDENT_COOKIE, token, {
    prefix: "host",
    httpOnly: true,
    sameSite: "Lax",
    // null: a browser-session cookie, gone when the browser closes.
    ...(maxAgeMs !== null && { maxAge: Math.floor(maxAgeMs / 1000) }),
  });
}

const loginInput = z.object({
  username: z.string().trim().toLowerCase().min(1).max(100),
  password: z.string().min(1).max(200),
  sharedDevice: z.boolean().optional(),
  token: z.boolean().optional(),
});

const keyInput = z.object({
  key: z.string().min(1).max(200),
  sharedDevice: z.boolean().optional(),
  token: z.boolean().optional(),
});

const impersonateInput = z.object({ code: z.string().min(1).max(200), token: z.boolean().optional() });

const eventsInput = z.object({
  events: z.array(z.unknown()),
  afterEventId: z.number().int().nullable().optional(),
});

const snapshotInput = z.object({
  data: z.looseObject({ data: z.record(z.string(), z.unknown()) }),
});

async function json<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: "Send JSON" });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: "Invalid input" });
  return parsed.data;
}

export function studentApi({ db, config }: Deps) {
  const passwordFailures = new FailureLimiter();
  // Keys are 192 random bits, so this only keeps a broken scanner quiet.
  const keyFailures = new FailureLimiter(100);
  const storeLimits = { maxBytes: config.store.maxBytes, compactAfter: config.store.compactAfter };

  const cors = createMiddleware<BookEnv>(async (c, next) => {
    const origin = c.req.header("origin");
    const allowed = externalOrigin(c.get("book"));
    if (origin && allowed && origin === allowed) {
      c.header("access-control-allow-origin", origin);
      c.header("vary", "Origin");
      if (c.req.method === "OPTIONS") {
        c.header("access-control-allow-methods", "GET, POST");
        c.header("access-control-allow-headers", "Authorization, Content-Type");
        c.header("access-control-max-age", "600");
        return c.body(null, 204);
      }
    }
    await next();
  });

  const originCheck = createMiddleware<BookEnv>(async (c, next) => {
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      const book = c.get("book");
      const origin = c.req.header("origin");
      // Its address on the books domain, and its custom domain if active.
      const own = [bookOrigin(config, book.slug), publicOrigin(config, book)];
      const bearer = c.req.header("authorization")?.startsWith("Bearer ");
      const fromExternal = origin !== undefined && origin === externalOrigin(book);
      // Cross-origin only without cookies: Bearer requests and token logins
      // (which carry nothing to forge).
      if (!(origin && own.includes(origin)) && !bearer && !fromExternal) {
        throw new HTTPException(403, { message: "Cross-origin request refused" });
      }
      if (!c.req.header("content-type")?.startsWith("application/json")) {
        throw new HTTPException(415, { message: "Send JSON" });
      }
    }
    await next();
  });

  const requireStudent = createMiddleware<BookEnv>(async (c, next) => {
    if (!c.get("student")) throw new HTTPException(401, { message: "Not logged in" });
    await next();
  });

  const requireWritable = createMiddleware<BookEnv>(async (c, next) => {
    if (c.get("student")?.readonly) {
      throw new HTTPException(403, { message: "This is a read-only view of a student's work" });
    }
    await next();
  });

  function start(
    c: Context<BookEnv>,
    studentId: number,
    options: { token?: boolean; sharedDevice?: boolean; readonly?: boolean; impersonatedBy?: number },
  ) {
    const kind = options.token ? "token" : "cookie";
    const persistent = !options.sharedDevice;
    const token = createStudentSession(db, {
      studentId,
      kind,
      persistent,
      readonly: options.readonly,
      impersonatedBy: options.impersonatedBy,
    });
    if (kind === "cookie") {
      setStudentCookie(
        c,
        token,
        options.readonly ? READONLY_LIFETIME_MS : persistent ? STUDENT_SESSION_LIFETIME_MS : null,
      );
    }
    return kind === "token" ? token : undefined;
  }

  function studentOf(bookId: number, where: ReturnType<typeof eq>) {
    return db
      .select()
      .from(students)
      .where(and(eq(students.bookId, bookId), where))
      .get();
  }

  return new Hono<BookEnv>()
    .use(cors)
    .use(originCheck)

    .post("/login", async (c) => {
      const book = c.get("book");
      const input = await json(c, loginInput);
      const key = `${book.id}:${input.username}`;
      if (passwordFailures.isBlocked(key)) {
        throw new HTTPException(429, { message: "Too many failed attempts. Try again in 15 minutes." });
      }
      const student = studentOf(book.id, eq(students.username, input.username));
      // Hash even for unknown names, so timing does not reveal which exist.
      const ok = await verifyPassword(input.password, student?.passwordHash ?? (await dummyPasswordHash()));
      if (!student || !ok) {
        passwordFailures.fail(key);
        throw new HTTPException(401, { message: "Username or password is wrong" });
      }
      passwordFailures.succeed(key);
      db.update(students).set({ lastLoginAt: new Date() }).where(eq(students.id, student.id)).run();
      const token = start(c, student.id, input);
      return c.json({ user: { username: student.username }, readonly: false, ...(token && { token }) });
    })

    .post("/login/key", async (c) => {
      const book = c.get("book");
      const input = await json(c, keyInput);
      const limiterKey = String(book.id);
      if (keyFailures.isBlocked(limiterKey)) {
        throw new HTTPException(429, { message: "Too many failed attempts. Try again in 15 minutes." });
      }
      const student = studentOf(book.id, eq(students.loginKeyHash, sha256(input.key)));
      if (!student) {
        keyFailures.fail(limiterKey);
        throw new HTTPException(401, { message: "This login code is not valid (any more). Ask your teacher." });
      }
      db.update(students).set({ lastLoginAt: new Date() }).where(eq(students.id, student.id)).run();
      const token = start(c, student.id, input);
      return c.json({ user: { username: student.username }, readonly: false, ...(token && { token }) });
    })

    .post("/impersonate", async (c) => {
      const book = c.get("book");
      const input = await json(c, impersonateInput);
      const redeemed = redeemImpersonationCode(db, input.code);
      const student = redeemed && studentOf(book.id, eq(students.id, redeemed.studentId));
      if (!redeemed || !student) {
        throw new HTTPException(401, { message: "This link has expired. Open it again from Hyperbook Cloud." });
      }
      const token = start(c, student.id, { token: input.token, readonly: true, impersonatedBy: redeemed.userId });
      return c.json({ user: { username: student.username }, readonly: true, ...(token && { token }) });
    })

    .post("/logout", (c) => {
      const student = c.get("student");
      if (student) deleteStudentSession(db, student.idHash);
      deleteCookie(c, STUDENT_COOKIE, { prefix: "host" });
      return c.json({ ok: true as const });
    })

    .get("/session", requireStudent, (c) => {
      const student = c.get("student")!;
      return c.json({ user: { username: student.username }, readonly: student.readonly });
    })

    .get("/store", requireStudent, (c) => {
      const state = readState(db, c.get("student")!.studentId);
      return c.json(state);
    })

    .post(
      "/store/events",
      requireStudent,
      requireWritable,
      bodyLimit({
        maxSize: config.store.maxBytes,
        onError: () => {
          throw new HTTPException(413, { message: "Too much data in one request" });
        },
      }),
      async (c) => {
        const input = await json(c, eventsInput);
        const problem = validateEvents(input.events);
        if (problem) throw new HTTPException(400, { message: problem });
        try {
          const result = appendEvents(
            db,
            c.get("student")!.studentId,
            input.events as WireEvent[],
            input.afterEventId,
            storeLimits,
          );
          if (result.conflict) {
            return c.json(
              { error: "Stale state — re-fetch required", serverLastEventId: result.serverLastEventId },
              409,
            );
          }
          return c.json({ success: true, lastEventId: result.lastEventId });
        } catch (error) {
          if (error instanceof StoreTooLargeError) throw new HTTPException(413, { message: error.message });
          throw error;
        }
      },
    )

    .post(
      "/store/snapshot",
      requireStudent,
      requireWritable,
      bodyLimit({
        maxSize: config.store.maxBytes,
        onError: () => {
          throw new HTTPException(413, { message: "Too much data in one request" });
        },
      }),
      async (c) => {
        const input = await json(c, snapshotInput);
        try {
          const result = replaceSnapshot(db, c.get("student")!.studentId, input.data as unknown as Snapshot, storeLimits);
          return c.json({ success: true, lastEventId: result.lastEventId });
        } catch (error) {
          if (error instanceof StoreTooLargeError) throw new HTTPException(413, { message: error.message });
          throw error;
        }
      },
    )

    .all("*", (c) => c.json({ error: "Not found" }, 404));
}

