import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { historyInput, liveDiffInput } from "../../../shared/schemas";
import type { Deps } from "../../deps";
import { bookAccess } from "../../domain/books";
import {
  GitError,
  commitDiff,
  headCommit,
  isMainAncestor,
  listTags,
  logCommits,
  rangeDiff,
} from "../../hosting/git";
import { tagMap } from "../../hosting/publish-tags";
import { repoDir } from "../../hosting/storage";
import type { AuthedEnv } from "../env";
import { requireUser } from "../middleware";
import { idParam } from "../params";
import { validate } from "../validate";
import { hostedOnly } from "./publishing";

/*
 * The book's git history for the editor's History pane: pages of commits
 * (author, message, +N -N) and, per commit, its diff. A book's source is a
 * git repository already — every save, upload and push is a commit — so
 * this reads what the repository has instead of mirroring it into SQLite.
 *
 * Commits are immutable, which the diff route leans on: its answers are
 * ETagged, so a second click on the same commit costs nothing.
 */

/** A commit's diff is cut off at this size; the pane says so below it. */
const MAX_DIFF_BYTES = 1024 * 1024;

const shaParam = validate(
  "param",
  z.object({
    id: z.coerce.number().int().positive(),
    sha: z.string().regex(/^[0-9a-f]{40}$/, "validation.sha"),
  }),
);

/**
 * Whether `sha` is one of the book's commits. A well-formed sha that no
 * longer exists (history rewritten by a push) is `false`, not an error: it
 * is just a cursor or commit the teacher cannot see.
 */
async function reachable(repo: string, sha: string): Promise<boolean> {
  try {
    return await isMainAncestor(repo, sha);
  } catch (error) {
    if (error instanceof GitError) return false;
    throw error;
  }
}

/** /api/books/:id/history */
export function bookHistoryRoutes({ db, config }: Deps) {
  return (
    new Hono<AuthedEnv>()
      .use(requireUser)

      // One page of the book's commits, newest first. `after` is the last
      // commit of the page before it; `next` in the answer is the cursor of
      // the page after, or null when the history ends there.
      .get(
        "/:id/history",
        idParam,
        validate("query", historyInput),
        async (c) => {
          const user = c.get("user");
          const { book } = bookAccess(db, user, c.req.valid("param").id);
          hostedOnly(book);
          const { after, limit, path } = c.req.valid("query");
          const repo = repoDir(config, book.id);
          if (!(await headCommit(repo).catch(() => null))) {
            return c.json({ commits: [], next: null });
          }
          // A cursor that fell out of the history (a push rewrote it) ends the
          // paging instead of failing: there is nothing older to show.
          if (after && !(await reachable(repo, after))) {
            return c.json({ commits: [], next: null });
          }
          // One commit more than asked for: its presence is the next page.
          const [found, tags] = await Promise.all([
            logCommits(repo, { limit: limit + 1, after: after ?? null, path }),
            tagMap(config, book.id),
          ]);
          // The live commit ("published") and the published versions (v<N>),
          // so the pane can show which saves are live.
          const commits = found.map((commit) => ({ ...commit, tags: tags.get(commit.sha) ?? [] }));
          if (commits.length > limit) {
            const page = commits.slice(0, limit);
            return c.json({ commits: page, next: page[page.length - 1]!.sha });
          }
          return c.json({ commits, next: null });
        },
      )

      // The changes from the live version (the "published" tag) to the
      // latest save, of the whole book or of `path`: what a publish would
      // change. Before anything is published, everything is new.
      .get("/:id/history/live-diff", idParam, validate("query", liveDiffInput), async (c) => {
        const user = c.get("user");
        const { book } = bookAccess(db, user, c.req.valid("param").id);
        hostedOnly(book);
        const { path } = c.req.valid("query");
        const repo = repoDir(config, book.id);
        const head = await headCommit(repo).catch(() => null);
        if (!head) return c.json({ live: null, head: null, diff: "", truncated: false });
        const live =
          book.publishedBuildId !== null
            ? ((await listTags(repo).catch(() => [])).find((t) => t.name === "published")?.commit ?? null)
            : null;
        const diff = live === head ? "" : await rangeDiff(repo, live, head, path);
        const truncated = Buffer.byteLength(diff, "utf8") > MAX_DIFF_BYTES;
        return c.json({
          live,
          head,
          diff: truncated ? Buffer.from(diff, "utf8").slice(0, MAX_DIFF_BYTES).toString("utf8") : diff,
          truncated,
        });
      })

      .get("/:id/history/:sha/diff", shaParam, async (c) => {
        const user = c.get("user");
        const { book } = bookAccess(db, user, c.req.valid("param").id);
        hostedOnly(book);
        const sha = c.req.valid("param").sha;
        const repo = repoDir(config, book.id);
        if (!(await reachable(repo, sha))) {
          throw new HTTPException(404, { message: "No such commit" });
        }
        const diff = await commitDiff(repo, sha);
        const truncated = Buffer.byteLength(diff, "utf8") > MAX_DIFF_BYTES;
        // A commit never changes: the answer may be cached as long as the
        // session is, and the sha is its own ETag.
        c.header("etag", sha);
        c.header("cache-control", "private, max-age=86400, immutable");
        return c.json({
          // Cut on a byte boundary; toString() drops the incomplete character.
          diff: truncated
            ? Buffer.from(diff, "utf8")
                .slice(0, MAX_DIFF_BYTES)
                .toString("utf8")
            : diff,
          truncated,
        });
      })
  );
}
