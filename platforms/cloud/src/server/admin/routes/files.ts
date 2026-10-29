import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { bookPath, commitFilesInput, initFilesInput, renderPageInput } from "../../../shared/schemas";
import { type ScannedPage, findReferences, isScannedPage } from "../../../shared/references";
import type { SessionUser } from "../../auth/sessions";
import type { Deps } from "../../deps";
import { type BookRow, bookAccess } from "../../domain/books";
import { quotaForBook, quotaMessage, setSourceBytes } from "../../domain/storage";
import { bookTemplate } from "../../domain/templates";
import {
  BookTooLargeError,
  type Change,
  ChangeConflictError,
  commitChanges,
  headCommit,
  initRepo,
  listTree,
  readBlob,
} from "../../hosting/git";
import { RenderError } from "../../hosting/renders";
import { repoDir } from "../../hosting/storage";
import { createPreviewCode } from "../../auth/preview-sessions";
import { previewOrigin } from "../../config";
import type { AuthedEnv } from "../env";
import { requireUser } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";
import { hostedOnly } from "./publishing";

/** Root files every build reads; a broken one fails every build. */
const ROOT_CONFIGS = new Set(["hyperbook.json", "hyperlibrary.json"]);

function checkRootConfig(path: string, content: Buffer) {
  if (!ROOT_CONFIGS.has(path)) return;
  let value: unknown;
  try {
    value = JSON.parse(content.toString("utf8"));
  } catch (error) {
    throw new HTTPException(400, { message: `${path} is not valid JSON: ${(error as Error).message}` });
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HTTPException(400, { message: `${path} must be a JSON object ({ … })` });
  }
}

/** "Edit book/index.md", "Edit 3 files", … */
function describe(changes: Change[]): string {
  if (changes.length > 1) return `Change ${changes.length} files`;
  const [ch] = changes;
  if (ch!.op === "move") return `Rename ${ch!.from} to ${ch!.to}`;
  if (ch!.op === "delete") return `Delete ${ch!.path}`;
  return `${ch!.baseOid === null ? "Add" : "Edit"} ${ch!.path}`;
}

/** /api/books/:id/files */
export function bookFileRoutes({ db, config, renders }: Deps) {
  const committer = {
    name: "Hyperbook Cloud",
    email: `noreply@${config.adminHost.replace(/:\d+$/, "")}`,
  };
  const author = (user: SessionUser) => ({
    name: user.displayName || user.email.split("@")[0]!,
    email: user.email,
  });

  async function listing(book: BookRow) {
    const repo = repoDir(config, book.id);
    const commit = await headCommit(repo).catch(() => null);
    const files = commit ? await listTree(repo, commit) : [];
    return { commit, files: files.map(({ path, size, oid }) => ({ path, size, oid })) };
  }

  /** Commits `changes` and answers with the new listing. Builds wait for publishing. */
  async function save(book: BookRow, user: SessionUser, changes: Change[], message?: string) {
    const repo = repoDir(config, book.id);
    await initRepo(repo);
    const quota = quotaForBook(db, book.id);
    const byQuota = quota !== null && quota.maxBytes < config.bookMaxBytes;
    let result;
    try {
      result = await commitChanges(repo, changes, {
        message: message || describe(changes),
        author: author(user),
        committer,
        maxBytes: byQuota ? quota.maxBytes : config.bookMaxBytes,
      });
    } catch (error) {
      if (error instanceof ChangeConflictError) {
        throw new HTTPException(409, {
          res: Response.json({ error: error.message, conflicts: error.paths }, { status: 409 }),
        });
      }
      if (error instanceof BookTooLargeError) {
        throw new HTTPException(413, { message: byQuota ? quotaMessage(quota.owner, user.email) : error.message });
      }
      throw error;
    }
    const now = await listing(book);
    setSourceBytes(db, book.id, now.files.reduce((sum, f) => sum + f.size, 0));
    return { changed: result.changed, ...now };
  }

  return new Hono<AuthedEnv>()
    .use(requireUser)

    .get("/:id/files", idParam, async (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      return c.json(await listing(book));
    })

    // The book's language, for elements whose content depends on it
    // (struktolab's keywords).
    .get("/:id/files/language", idParam, async (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      const repo = repoDir(config, book.id);
      const commit = await headCommit(repo).catch(() => null);
      const settings = commit ? (await listTree(repo, commit)).find((e) => e.path === "hyperbook.json") : undefined;
      let language = "en";
      try {
        const parsed = settings ? JSON.parse((await readBlob(repo, settings.oid)).toString("utf8")) : {};
        if (typeof parsed.language === "string") language = parsed.language;
      } catch {
        // A broken hyperbook.json: keep the default.
      }
      return c.json({ language });
    })

    // Where a file, or a folder of files, is referenced from: the pages that
    // link at it, or point a directive's attribute at it. The editor asks
    // before a rename, move or delete, and rewrites these when the file moves.
    .get(
      "/:id/files/references",
      idParam,
      validate("query", z.object({ path: bookPath })),
      async (c) => {
        const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
        const repo = repoDir(config, book.id);
        const commit = await headCommit(repo).catch(() => null);
        const tree = commit ? await listTree(repo, commit) : [];
        const pages: ScannedPage[] = [];
        for (const entry of tree) {
          // Larger pages are not scanned; a link in them is as broken as one
          // nobody reported.
          if (!isScannedPage(entry.path) || entry.size > 1024 * 1024) continue;
          pages.push({ path: entry.path, text: (await readBlob(repo, entry.oid)).toString("utf8") });
        }
        const references = findReferences(
          pages,
          tree.map((entry) => entry.path),
          c.req.valid("query").path,
        );
        const texts = new Map(pages.map((page) => [page.path, page.text]));
        const oids = new Map(tree.map((entry) => [entry.path, entry.oid]));
        const files = [...new Set(references.map((ref) => ref.file))].map((path) => ({
          path,
          oid: oids.get(path)!,
          text: texts.get(path)!,
        }));
        return c.json({ references, files });
      },
    )

    // The bytes of one file. Never rendered on this origin: teacher-written
    // HTML or SVG must not run next to the admin session.
    .get("/:id/files/raw", idParam, validate("query", z.object({ path: bookPath })), async (c) => {
      const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
      const repo = repoDir(config, book.id);
      const commit = await headCommit(repo).catch(() => null);
      const entry = commit
        ? (await listTree(repo, commit)).find((e) => e.path === c.req.valid("query").path)
        : undefined;
      if (!entry) throw new HTTPException(404, { message: "No such file" });
      const name = entry.path.split("/").pop()!;
      c.header("content-type", "application/octet-stream");
      c.header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
      c.header("x-content-type-options", "nosniff");
      c.header("cache-control", "private, no-cache");
      c.header("x-oid", entry.oid);
      return c.body(new Uint8Array(await readBlob(repo, entry.oid)));
    })

    .post(
      "/:id/files/commit",
      idParam,
      bodyLimit({
        // Base64 makes uploads a third larger.
        maxSize: Math.ceil(config.uploadMaxBytes * 1.4) + 64 * 1024,
        onError: () => {
          throw new HTTPException(413, {
            message: `Save at most ${config.uploadMaxBytes / 1024 / 1024} MB at once`,
          });
        },
      }),
      validate("json", commitFilesInput),
      async (c) => {
        const user = c.get("user");
        const { book } = bookAccess(db, user, c.req.valid("param").id);
        hostedOnly(book);
        const input = c.req.valid("json");
        const changes: Change[] = input.changes.map((ch) => {
          if (ch.op !== "write") return ch;
          const content = Buffer.from(ch.content, ch.encoding);
          checkRootConfig(ch.path, content);
          return { op: "write", path: ch.path, content, baseOid: ch.baseOid };
        });
        return c.json(await save(book, user, changes, input.message));
      },
    )

    // A page with the editor's unsaved text, for the preview host to show
    // (see hosting/renders.ts).
    .post(
      "/:id/files/render",
      idParam,
      bodyLimit({
        maxSize: 3 * 1024 * 1024,
        onError: () => {
          throw new HTTPException(413, { message: "The page is too long to preview" });
        },
      }),
      validate("json", renderPageInput),
      async (c) => {
        const { book } = bookAccess(db, c.get("user"), c.req.valid("param").id);
        hostedOnly(book);
        const { path, text } = c.req.valid("json");
        try {
          return c.json(await renders.renderText(book.id, path, text));
        } catch (error) {
          if (error instanceof RenderError) throw new HTTPException(400, { message: error.message });
          throw error;
        }
      },
    )

    // A one-time hand-off into the book's preview host (see books/preview.ts).
    .post("/:id/preview-code", idParam, (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id);
      hostedOnly(book);
      const code = createPreviewCode(db, user.id, book.id);
      return c.json({
        origin: previewOrigin(config, book.slug),
        url: `${previewOrigin(config, book.slug)}/_hyperbook/preview#c=${code}`,
      });
    })

    .post("/:id/files/init", idParam, validate("json", initFilesInput), async (c) => {
      const user = c.get("user");
      const { book } = bookAccess(db, user, c.req.valid("param").id);
      hostedOnly(book);
      if (await headCommit(repoDir(config, book.id)).catch(() => null)) {
        throw new HTTPException(409, { message: "The book has files already" });
      }
      const files = bookTemplate(c.req.valid("json").template, book.title);
      const changes: Change[] = Object.entries(files).map(([path, content]) => ({
        op: "write",
        path,
        content: Buffer.from(content),
        baseOid: null,
      }));
      return c.json(await save(book, user, changes, "Start the book"));
    });
}
