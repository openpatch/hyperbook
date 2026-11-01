import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { historyInput } from "../../../shared/schemas";
import type { Deps } from "../../deps";
import { bookAccess } from "../../domain/books";
import {
  type CommitSummary,
  GitError,
  commitDiff,
  headCommit,
  isMainAncestor,
  logCommits,
} from "../../hosting/git";
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
          const commits = await logCommits(repo, {
            limit: limit + 1,
            after: after ?? null,
            path,
          });
          if (commits.length > limit) {
            const page = commits.slice(0, limit) as CommitSummary[];
            return c.json({ commits: page, next: page[page.length - 1]!.sha });
          }
          return c.json({ commits, next: null });
        },
      )

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
