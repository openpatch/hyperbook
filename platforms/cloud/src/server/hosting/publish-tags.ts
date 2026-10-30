import type { Config } from "../config";
import type { Db } from "../db/client";
import { repoDir } from "./storage";
import {
  deleteTag,
  listTags,
  resolveTagCommit,
  setTag,
  versionTagNumbers,
} from "./git";

/*
 * Publish history as git tags, written only by the server: on every publish a
 * new v<N> tag is created (N = highest existing number + 1, so republishing a
 * commit that already has a build never collides with an existing tag) and
 * the "published" tag is moved to it. Only the last KEEP_TAGS v<N> tags are
 * kept. All of it is serialized per book, so a publish racing a rollback or a
 * push cannot interleave.
 */

/** Successful version tags kept besides the newest ones (their builds too). */
export const KEEP_TAGS = 2;

const locks = new Map<number, Promise<unknown>>();

/** Runs `fn` alone per book (one process serves the instance). */
export function withBookLock<T>(
  bookId: number,
  fn: () => T | Promise<T>,
): Promise<T> {
  const prev = locks.get(bookId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(
    bookId,
    next.catch(() => {}),
  );
  return next;
}

/**
 * Records a publish: creates v<N> for `commit` (unless `published` already
 * points at it), moves `published`, and prunes all but the last KEEP_TAGS
 * v-tags. Called when a build becomes the published one and on instant
 * publishes that reuse a kept build.
 */
export async function markPublished(
  db: Db,
  config: Config,
  bookId: number,
  commit: string,
) {
  const repo = repoDir(config, bookId);
  await withBookLock(bookId, async () => {
    const tags = await listTags(repo).catch(
      () => [] as { name: string; commit: string }[],
    );
    const published = tags.find((t) => t.name === "published");
    if (published?.commit !== commit) {
      const numbers = await versionTagNumbers(repo);
      const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
      await setTag(repo, `v${next}`, commit);
    }
    await setTag(repo, "published", commit);
    const vTags = (await listTags(repo))
      .filter((t) => /^v\d+$/.test(t.name))
      .sort((a, b) => Number(b.name.slice(1)) - Number(a.name.slice(1)));
    for (const tag of vTags.slice(KEEP_TAGS)) await deleteTag(repo, tag.name);
  });
}

/** Moves only the "published" tag (a rollback reuses an existing v<N>). */
export async function movePublishedTag(
  config: Config,
  bookId: number,
  commit: string,
) {
  const repo = repoDir(config, bookId);
  await withBookLock(bookId, async () => {
    await setTag(repo, "published", commit);
  });
}

/** tag name → commit, for showing tags on builds; empty when there is no repo yet. */
export async function tagMap(
  config: Config,
  bookId: number,
): Promise<Map<string, string[]>> {
  const repo = repoDir(config, bookId);
  const map = new Map<string, string[]>();
  for (const { name, commit } of await listTags(repo).catch(
    () => [] as { name: string; commit: string }[],
  )) {
    const list = map.get(commit) ?? [];
    list.push(name);
    map.set(commit, list);
  }
  return map;
}

/** The commit of a version tag, or null when the book has no such tag. */
export function tagCommit(config: Config, bookId: number, tag: string) {
  return resolveTagCommit(repoDir(config, bookId), tag);
}
