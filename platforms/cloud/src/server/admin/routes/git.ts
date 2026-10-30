import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { z } from "zod";
import { gitTokenInput } from "../../../shared/schemas";
import { audit } from "../../audit";
import { FailureLimiter, OpLimiter } from "../../auth/rate-limit";
import { randomToken, sha256 } from "../../crypto/tokens";
import type { Deps } from "../../deps";
import { type BookRow, addCommits, bookAccess } from "../../domain/books";
import { getInstanceSettings } from "../../domain/instance";
import { quotaForBook, setSourceBytes } from "../../domain/storage";
import { bookMembers, books, gitTokens, users } from "../../db/schema";
import {
  headCommit,
  initRepo,
  listTree,
  parseRefUpdates,
  revListCount,
  spawnGit,
} from "../../hosting/git";
import { withBookLock } from "../../hosting/publish-tags";
import { repoDir } from "../../hosting/storage";
import type { AuthedEnv } from "../env";
import { requireUser } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";
import { hostedOnly } from "./publishing";

/*
 * Git smart HTTP for books, on the admin origin:
 *
 *   GET  /api/books/:id/git/info/refs?service=git-{upload,receive}-pack
 *   POST /api/books/:id/git/git-upload-pack
 *   POST /api/books/:id/git/git-receive-pack
 *
 * so `git clone https://git@<ADMIN_ORIGIN>/api/books/<id>/git` works. These
 * routes are mounted outside the /api sub-app (admin/app.ts), so originCheck
 * does not apply: the git content types are not CORS-safelisted, which makes
 * cross-site POSTs fail their preflight, and cross-site reads are blocked
 * because no CORS headers are ever sent. Authentication is a per-book API
 * token as the Basic password (username "git"); the session cookie is not
 * accepted here. A push never triggers a publish build — only the quota
 * check, an audit entry and the commit count (plus a preview build when the
 * instance setting gitPushUpdatesPreview is on).
 */

const ZERO = "0".repeat(40);
const MAX_TOKENS_PER_USER = 10;

type GitEnv = {
  Variables: { gitBook: BookRow; gitUserId: number };
};

type Basic = { username: string; password: string };

function parseBasic(header: string | undefined): Basic | null {
  const match = /^Basic (.+)$/i.exec(header ?? "");
  if (!match) return null;
  let decoded: string;
  try {
    decoded = Buffer.from(match[1]!, "base64").toString("utf8");
  } catch {
    return null;
  }
  const colon = decoded.indexOf(":");
  if (colon < 0) return null;
  return {
    username: decoded.slice(0, colon),
    password: decoded.slice(colon + 1),
  };
}

/** The token row when `password` is a live token of book `bookId` whose user may edit it. */
function authenticate(db: Deps["db"], bookId: number, password: string) {
  if (!password) return null;
  const row = db
    .select()
    .from(gitTokens)
    .where(
      and(eq(gitTokens.idHash, sha256(password)), isNull(gitTokens.revokedAt)),
    )
    .get();
  if (!row || row.bookId !== bookId) return null;
  const user = db.select().from(users).where(eq(users.id, row.userId)).get();
  if (!user || user.disabledAt) return null;
  if (user.role !== "admin") {
    const member = db
      .select({ role: bookMembers.role })
      .from(bookMembers)
      .where(
        and(eq(bookMembers.bookId, bookId), eq(bookMembers.userId, user.id)),
      )
      .get();
    if (!member) return null;
  }
  return { row, user };
}

/** Only allow a well-formed Git-Protocol header through to git (protocol v2). */
function gitProtocolEnv(c: Context): Record<string, string> {
  const proto = c.req.header("git-protocol");
  if (proto && /^version=\d+(,version=\d+)*$/.test(proto))
    return { GIT_PROTOCOL: proto };
  return {};
}

/** Collects output and waits for the child to exit; stdin is the caller's. */
async function closeWith(child: ChildProcess) {
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  child.stdout!.on("data", (d: Buffer) => out.push(d));
  child.stderr!.on("data", (d: Buffer) => err.push(d));
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  return {
    code,
    stdout: Buffer.concat(out),
    stderr: Buffer.concat(err).toString("utf8"),
  };
}

/** /api/books/:id/git/… — smart HTTP, token auth. Mounted before the /api sub-app. */
export function gitHttpRoutes({ db, config, builds }: Deps) {
  const authFailures = new FailureLimiter();
  const opLimit = new OpLimiter();

  const gitAuth = createMiddleware<GitEnv>(async (c, next) => {
    const id = Number(c.req.param("id"));
    const book = Number.isInteger(id)
      ? db.select().from(books).where(eq(books.id, id)).get()
      : undefined;
    const creds = parseBasic(c.req.header("authorization"));
    const failKey = `git:${id}:${creds ? sha256(creds.password).slice(0, 16) : "anon"}`;
    const deny = (): never => {
      authFailures.fail(failKey);
      c.header("WWW-Authenticate", 'Basic realm="Hyperbook Cloud git"');
      throw new HTTPException(401, {
        message: "A git token is required (username: git)",
      });
    };
    if (
      !book ||
      authFailures.isBlocked(failKey) ||
      opLimit.isBlocked(`book:${id}`)
    )
      deny();
    const authed = creds ? authenticate(db, id, creds.password) : null;
    if (!authed) deny();
    opLimit.hit(`book:${id}`);
    // Note the use, but not more often than once a minute per token.
    const row = authed!.row;
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
      db.update(gitTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(gitTokens.idHash, row.idHash))
        .run();
    }
    c.set("gitBook", book!);
    c.set("gitUserId", authed!.user.id);
    await next();
  });

  /**
   * After a successful push to main: quota bookkeeping, audit, commit count,
   * and (when the instance says so) a preview build. Never a publish build.
   */
  async function postPush(
    book: BookRow,
    userId: number,
    repo: string,
    requestBody: Buffer,
    exitedCleanly: boolean,
  ) {
    const update = parseRefUpdates(requestBody).find(
      (u) => u.ref === "refs/heads/main" && u.new !== ZERO,
    );
    if (!update || !exitedCleanly) return;
    if ((await headCommit(repo).catch(() => null)) !== update.new) return; // the hook refused it
    await withBookLock(book.id, async () => {
      const added = await revListCount(
        repo,
        update.old === ZERO ? null : update.old,
        update.new,
      );
      const bytes = (await listTree(repo, update.new)).reduce(
        (sum, e) => sum + e.size,
        0,
      );
      db.transaction((tx) => {
        setSourceBytes(tx as unknown as Deps["db"], book.id, bytes);
        addCommits(tx as unknown as Deps["db"], book.id, added);
      });
      audit(db, {
        actorUserId: userId,
        action: "book.push",
        targetType: "book",
        targetId: book.id,
        data: { commit: update.new, added, bytes },
      });
      if (getInstanceSettings(db).gitPushUpdatesPreview) {
        builds.enqueue(book.id, update.new, "push", userId);
      }
    });
  }

  // Mounted at /api/books/:id/git; the auth middleware is bound to the exact
  // service paths so the session-authenticated /tokens routes under the same
  // prefix are not caught by it.
  return new Hono<GitEnv>()
    .use("/info/refs", gitAuth)
    .use("/git-upload-pack", gitAuth)
    .use("/git-receive-pack", gitAuth)

    .get("/info/refs", async (c) => {
      const serviceName = c.req.query("service");
      if (
        serviceName !== "git-upload-pack" &&
        serviceName !== "git-receive-pack"
      ) {
        throw new HTTPException(400, {
          message:
            "Smart HTTP only (service=git-upload-pack or git-receive-pack)",
        });
      }
      const book = c.get("gitBook");
      if (book.source === "external")
        throw new HTTPException(409, {
          message: "This book is hosted elsewhere.",
        });
      const repo = repoDir(config, book.id);
      await initRepo(repo);
      // "git-upload-pack" runs as `git upload-pack`.
      const child = spawnGit(
        [
          serviceName.replace(/^git-/, ""),
          "--stateless-rpc",
          "--advertise-refs",
          repo,
        ],
        {
          gitDir: repo,
          env: gitProtocolEnv(c),
        },
      );
      const { code, stdout, stderr } = await closeWith(child);
      if (code !== 0) throw new HTTPException(500, { message: stderr.trim() });
      // Smart HTTP expects the "# service=…" pkt-line + flush before the
      // advertisement (git http-backend adds it; receive-pack/upload-pack
      // alone do not).
      const line = `# service=${serviceName}\n`;
      const serviceHeader = Buffer.from(
        `${(line.length + 4).toString(16).padStart(4, "0")}${line}0000`,
      );
      c.header("content-type", `application/x-${serviceName}-advertisement`);
      c.header("cache-control", "no-cache");
      return c.body(Buffer.concat([serviceHeader, stdout]), 200);
    })

    .post("/git-upload-pack", (c) => {
      const book = c.get("gitBook");
      if (book.source === "external")
        throw new HTTPException(409, {
          message: "This book is hosted elsewhere.",
        });
      const repo = repoDir(config, book.id);
      return initRepo(repo).then(() => {
        const child = spawnGit(["upload-pack", "--stateless-rpc", repo], {
          gitDir: repo,
          env: gitProtocolEnv(c),
        });
        const body = c.req.raw.body;
        if (body) Readable.fromWeb(body as never).pipe(child.stdin!);
        else child.stdin!.end();
        child.stderr!.resume();
        child.on("close", (code) => {
          if (code !== 0)
            console.error(`git upload-pack exited ${code} for book ${book.id}`);
        });
        c.header("content-type", "application/x-git-upload-pack-result");
        c.header("cache-control", "no-cache");
        // The response can be the whole repository, so it is streamed; git
        // reports ref-level errors in-band.
        return c.body(Readable.toWeb(child.stdout!) as ReadableStream, 200);
      });
    })

    .post("/git-receive-pack", async (c) => {
      const book = c.get("gitBook");
      if (book.source === "external")
        throw new HTTPException(409, {
          message: "This book is hosted elsewhere.",
        });
      const repo = repoDir(config, book.id);
      await initRepo(repo);
      const quota = quotaForBook(db, book.id);
      const maxBytes =
        quota && quota.maxBytes < config.bookMaxBytes
          ? quota.maxBytes
          : config.bookMaxBytes;
      // The pre-receive hook enforces the ref rules and the tree size; these
      // guard the pack itself. The hooksPath override comes after
      // SAFE_CONFIG's /dev/null, so only receive-pack runs the hook.
      const child = spawnGit(
        [
          "-c",
          "receive.denyDeletes=true",
          "-c",
          "receive.denyNonFastForwards=true",
          "-c",
          "receive.fsckObjects=true",
          "-c",
          `receive.maxInputSize=${config.uploadMaxBytes}`,
          "-c",
          `core.hooksPath=${path.join(repo, "hooks")}`,
          "receive-pack",
          "--stateless-rpc",
          repo,
        ],
        { gitDir: repo, env: { HB_MAX_BYTES: String(maxBytes) } },
      );
      // Stream the request in, capped, and tee it to read the ref updates
      // after the push; the answer is small, so it is buffered.
      const body = c.req.raw.body;
      if (!body) throw new HTTPException(400, { message: "Empty request" });
      let received = 0;
      const chunks: Buffer[] = [];
      const cap = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          received += chunk.length;
          if (received > config.uploadMaxBytes) {
            cb(new Error("over the limit"));
            return;
          }
          chunks.push(chunk);
          cb(null, chunk);
        },
      });
      const src = Readable.fromWeb(body as never);
      src.pipe(cap).pipe(child.stdin!);
      src.on("error", () => child.kill());
      const { code, stdout, stderr } = await closeWith(child);
      if (received > config.uploadMaxBytes) {
        throw new HTTPException(413, {
          message: `The push is larger than ${Math.round(config.uploadMaxBytes / 1024 / 1024)} MB`,
        });
      }
      if (code !== 0 && stdout.length === 0) {
        throw new HTTPException(500, {
          message: `git receive-pack failed: ${stderr.trim()}`,
        });
      }
      await postPush(
        book,
        c.get("gitUserId"),
        repo,
        Buffer.concat(chunks),
        code === 0,
      );
      c.header("content-type", "application/x-git-receive-pack-result");
      c.header("cache-control", "no-cache");
      return c.body(stdout, 200);
    });
}

/** /api/books/:id/git/tokens — create, list and revoke git API tokens (session auth). */
export function gitTokenRoutes({ db }: Deps) {
  const tokenParam = validate(
    "param",
    z.object({
      id: z.coerce.number().int().positive(),
      tokenId: z.string().length(64),
    }),
  );

  return new Hono<AuthedEnv>()
    .use(requireUser)

    .get("/:id/git/tokens", idParam, (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      hostedOnly(book);
      const rows = db
        .select({
          idHash: gitTokens.idHash,
          label: gitTokens.label,
          createdAt: gitTokens.createdAt,
          lastUsedAt: gitTokens.lastUsedAt,
          revokedAt: gitTokens.revokedAt,
          email: users.email,
        })
        .from(gitTokens)
        .leftJoin(users, eq(users.id, gitTokens.userId))
        .where(eq(gitTokens.bookId, book.id))
        .orderBy(desc(gitTokens.createdAt))
        .all();
      return c.json(
        rows.map((r) => ({
          id: r.idHash,
          label: r.label,
          user: r.email,
          createdAt: r.createdAt.getTime(),
          lastUsedAt: r.lastUsedAt?.getTime() ?? null,
          revokedAt: r.revokedAt?.getTime() ?? null,
        })),
      );
    })

    .post("/:id/git/tokens", idParam, validate("json", gitTokenInput), (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id);
      hostedOnly(book);
      const { label } = c.req.valid("json");
      const active = db
        .select({ n: sql<number>`count(*)` })
        .from(gitTokens)
        .where(
          and(
            eq(gitTokens.bookId, book.id),
            eq(gitTokens.userId, user.id),
            isNull(gitTokens.revokedAt),
          ),
        )
        .get();
      if ((active?.n ?? 0) >= MAX_TOKENS_PER_USER) {
        throw new HTTPException(409, {
          message: `You already have ${MAX_TOKENS_PER_USER} tokens for this book. Revoke one first.`,
        });
      }
      const token = randomToken();
      const idHash = sha256(token);
      db.insert(gitTokens)
        .values({ idHash, bookId: book.id, userId: user.id, label })
        .run();
      audit(db, {
        actorUserId: user.id,
        action: "book.git.token.create",
        targetType: "book",
        targetId: book.id,
        data: { label },
      });
      // The token is shown once; only its hash is stored.
      return c.json({ token, id: idHash, label, createdAt: Date.now() });
    })

    .delete("/:id/git/tokens/:tokenId", tokenParam, (c) => {
      const user = c.get("user");
      const { book, role } = bookAccess(db, user, c.req.valid("param").id);
      hostedOnly(book);
      const { tokenId } = c.req.valid("param");
      const row = db
        .select()
        .from(gitTokens)
        .where(
          and(eq(gitTokens.idHash, tokenId), eq(gitTokens.bookId, book.id)),
        )
        .get();
      if (!row) throw new HTTPException(404, { message: "Token not found" });
      // Owners may revoke any token of the book; others only their own.
      if (role !== "owner" && row.userId !== user.id) {
        throw new HTTPException(403, {
          message: "Only owners may revoke other people's tokens",
        });
      }
      db.update(gitTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(gitTokens.idHash, tokenId), isNull(gitTokens.revokedAt)))
        .run();
      audit(db, {
        actorUserId: user.id,
        action: "book.git.token.revoke",
        targetType: "book",
        targetId: book.id,
        data: { label: row.label },
      });
      return c.json({ ok: true as const });
    });
}
