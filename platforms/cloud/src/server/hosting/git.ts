import { spawn, type ChildProcessByStdio } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Readable, Writable } from "node:stream";

/*
 * Each book's source is a bare repository driven by the git CLI. No working
 * copy is kept: uploads are committed from the unpacked zip through a
 * temporary index, and builds check a commit out into their own directory.
 *
 * git runs without system or global config, hooks or a real HOME, so nothing
 * outside the repository changes what it does.
 */

const BRANCH = "refs/heads/main";

export class GitError extends Error {
  constructor(
    readonly args: string[],
    readonly code: number | null,
    readonly stderr: string,
  ) {
    super(`git ${args[0]} failed (${code}): ${stderr.trim()}`);
    this.name = "GitError";
  }
}

/** The branch moved while a commit was being made. */
export class ConcurrentChangeError extends Error {
  constructor() {
    super("The book was changed at the same time; try again");
    this.name = "ConcurrentChangeError";
  }
}

export type Identity = { name: string; email: string };

type RunOptions = {
  gitDir: string;
  /** Commands that work on files run inside the work tree. */
  cwd?: string;
  env?: Record<string, string>;
};

function gitEnv(options: RunOptions): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    // Reading config from HOME is switched off below; this just keeps git
    // from touching the server's real home directory.
    HOME: options.gitDir,
    GIT_DIR: options.gitDir,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    LC_ALL: "C",
    ...options.env,
  };
}

const SAFE_CONFIG = [
  "-c", "core.hooksPath=/dev/null",
  "-c", "core.symlinks=false",
  "-c", "core.autocrlf=false",
  "-c", "core.fsmonitor=false",
  "-c", "protocol.allow=never",
];

/** Runs git; also used by the smart-HTTP routes, which pipe request bodies in. */
export function spawnGit(
  args: string[],
  options: RunOptions,
): ChildProcessByStdio<Writable, Readable, Readable> {
  const child = spawn("git", [...SAFE_CONFIG, ...args], {
    env: gitEnv(options),
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });
  // git may exit before reading all of stdin (it failed); that is reported
  // through its exit code.
  child.stdin.on("error", () => {});
  return child;
}

/** Runs git and returns its stdout as bytes; `input` is written to stdin. */
async function gitBytes(args: string[], options: RunOptions & { input?: Buffer | string }): Promise<Buffer> {
  const child = spawnGit(args, options);
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  child.stdout.on("data", (d: Buffer) => out.push(d));
  child.stderr.on("data", (d: Buffer) => err.push(d));
  child.stdin.end(options.input);
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (code !== 0) {
    throw new GitError(args, code, Buffer.concat(err).toString("utf8"));
  }
  return Buffer.concat(out);
}

async function git(args: string[], options: RunOptions & { input?: Buffer | string }): Promise<string> {
  return (await gitBytes(args, options)).toString("utf8").trim();
}

/**
 * The pre-receive hook every book repository gets (initRepo). It is the only
 * hook, and receive-pack is the only command that runs it: the platform's own
 * git calls keep core.hooksPath=/dev/null. It allows only refs/heads/main,
 * rejects deletes and every other ref (tags included), rejects trees with
 * .git paths or submodule entries, and enforces the source-size limit the
 * server passes as HB_MAX_BYTES (the summed size of the new tree, computed
 * here because the hook is the last moment the push can still be refused).
 */
const PRE_RECEIVE = `#!/bin/sh
zero=0000000000000000000000000000000000000000
while read -r old new ref; do
  if [ "$ref" != "refs/heads/main" ]; then
    echo "Only the main branch may be pushed to this book (got $ref)." >&2
    exit 1
  fi
  if [ "$new" = "$zero" ]; then
    echo "Deleting main is not allowed. Push a new commit on top instead." >&2
    exit 1
  fi
  if git ls-tree -r "$new" | grep -q '^160000 '; then
    echo "Submodules are not supported in a book." >&2
    exit 1
  fi
  if git ls-tree -r --name-only -z "$new" | tr '\\0' '\\n' | grep -qiE '(^|/)\\.git(/|$)'; then
    echo "A book must not contain .git files or folders." >&2
    exit 1
  fi
  if [ -n "$HB_MAX_BYTES" ]; then
    size=$(git ls-tree -r -l "$new" | awk '{ s += $4 } END { print s+0 }')
    if [ "$size" -gt "$HB_MAX_BYTES" ]; then
      echo "The book would be larger than $((HB_MAX_BYTES / 1024 / 1024)) MB. Delete files you no longer need, or ask an admin for more space." >&2
      exit 1
    fi
  fi
done
exit 0
`;

/** Creates the bare repository unless it exists, and (re)writes its hook. */
export async function initRepo(repo: string) {
  mkdirSync(repo, { recursive: true });
  // An empty template: no sample hooks, no info/exclude.
  await git(["init", "--bare", "--quiet", "--template=", "--initial-branch=main"], {
    gitDir: repo,
  });
  const hooks = path.join(repo, "hooks");
  mkdirSync(hooks, { recursive: true });
  writeFileSync(path.join(hooks, "pre-receive"), PRE_RECEIVE);
  chmodSync(path.join(hooks, "pre-receive"), 0o755);
}

export async function headCommit(repo: string): Promise<string | null> {
  try {
    return await git(["rev-parse", "--verify", "--quiet", `${BRANCH}^{commit}`], {
      gitDir: repo,
    });
  } catch (error) {
    if (error instanceof GitError && error.code === 1) return null;
    throw error;
  }
}

/**
 * Commits the contents of `workTree` as the branch's new tree, honouring the
 * tree's own .gitignore files. Returns the new commit, or the current one when
 * nothing changed. Fails if the branch moved while committing.
 */
export async function commitTree(
  repo: string,
  workTree: string,
  options: { message: string; author: Identity; committer: Identity },
): Promise<{ commit: string; changed: boolean }> {
  const index = path.join(path.dirname(workTree), `index-${path.basename(workTree)}`);
  const env = { GIT_WORK_TREE: workTree, GIT_INDEX_FILE: index };
  try {
    await git(["add", "--all"], { gitDir: repo, cwd: workTree, env });
    const tree = await git(["write-tree"], { gitDir: repo, env });
    const parent = await headCommit(repo);
    if (parent) {
      const parentTree = await git(["rev-parse", `${parent}^{tree}`], { gitDir: repo });
      if (parentTree === tree) return { commit: parent, changed: false };
    }
    const commit = await git(
      ["commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", options.message],
      {
        gitDir: repo,
        env: {
          GIT_AUTHOR_NAME: options.author.name,
          GIT_AUTHOR_EMAIL: options.author.email,
          GIT_COMMITTER_NAME: options.committer.name,
          GIT_COMMITTER_EMAIL: options.committer.email,
        },
      },
    );
    // The old value makes this a compare-and-swap: a concurrent commit fails
    // here instead of being silently overwritten.
    try {
      await git(["update-ref", BRANCH, commit, parent ?? ""], { gitDir: repo });
    } catch (error) {
      if (error instanceof GitError) throw new ConcurrentChangeError();
      throw error;
    }
    return { commit, changed: true };
  } finally {
    rmSync(index, { force: true });
  }
}

/** Writes the files of `commit` into `dest` (which must exist). */
export async function checkout(repo: string, commit: string, dest: string) {
  const index = path.join(path.dirname(dest), `index-${path.basename(dest)}`);
  const env = { GIT_WORK_TREE: dest, GIT_INDEX_FILE: index };
  try {
    await git(["read-tree", commit], { gitDir: repo, env });
    await git(["checkout-index", "--all", "--force"], { gitDir: repo, cwd: dest, env });
  } finally {
    rmSync(index, { force: true });
  }
}

/**
 * Marks a checkout as the root of the book project. Hyperbook's `rfile` and
 * `rbase64` helpers read from the nearest `.git` above the page, and a
 * checkout has none — without this they find no project root at all (or a
 * `.git` far above the data directory). An empty `.git` directory makes the
 * checkout itself the root they resolve to, so those helpers pick up the
 * book's root. Never committed: uploads with a `.git` are refused.
 */
export async function markProjectRoot(dest: string) {
  await mkdir(path.join(dest, ".git"), { recursive: true }).catch(() => {
    // A book file called .git: leave it, the helpers then see a file, which
    // they accept as well.
  });
}

/** The files of `commit` as a zip, streamed. */
export function archiveZip(repo: string, commit: string): Readable {
  const child = spawnGit(["archive", "--format=zip", commit], { gitDir: repo });
  child.stdin.end();
  child.stderr.resume();
  child.on("close", (code) => {
    if (code !== 0) child.stdout.destroy(new GitError(["archive"], code, ""));
  });
  return child.stdout;
}

export type TreeEntry = { path: string; size: number; oid: string; mode: string };

/** Every file of `commit`, with its blob id and size. Links and submodules are left out. */
export async function listTree(repo: string, commit: string): Promise<TreeEntry[]> {
  const out = await gitBytes(["ls-tree", "-r", "-l", "-z", "--full-tree", commit], { gitDir: repo });
  const entries: TreeEntry[] = [];
  for (const line of out.toString("utf8").split("\0")) {
    if (!line) continue;
    // "<mode> <type> <oid> <size padded>\t<path>"
    const tab = line.indexOf("\t");
    const [mode, type, oid, size] = line.slice(0, tab).split(/ +/);
    if (type !== "blob" || mode === "120000") continue;
    entries.push({ path: line.slice(tab + 1), size: Number(size), oid: oid!, mode: mode! });
  }
  return entries;
}

export async function readBlob(repo: string, oid: string): Promise<Buffer> {
  return gitBytes(["cat-file", "blob", oid], { gitDir: repo });
}

/** A change to diff outside any repository, as the AI review dialog shows it. */
export type DiffChange =
  | { op: "write"; path: string; oldText: string | null; newText: string }
  | { op: "delete"; path: string; oldText: string };

/**
 * A unified diff of one proposed file change, from git itself: the two
 * versions live in a temporary `x/`/`y/` pair, so the diff's paths are the
 * book's. No repository is touched, no object is written — a denied
 * proposal leaves nothing behind but this function's own temp directory,
 * which is removed right away.
 */
export async function diffChange(change: DiffChange): Promise<string> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "cloud-ai-diff-"));
  try {
    const sides: [string | null, string] =
      change.op === "delete"
        ? [change.oldText, ""]
        : [change.oldText, change.newText];
    // Both sides exist even when a text is null (a new file, a deleted
    // file): an empty side is how git knows the file is added or gone.
    for (const side of ["x", "y"] as const) {
      await mkdir(path.join(dir, side), { recursive: true });
    }
    for (const [side, text] of [
      ["x", sides[0]],
      ["y", sides[1]],
    ] as const) {
      if (text === null) continue;
      const file = path.join(dir, side, change.path);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, text);
    }
    // git exits 1 when there are differences — that is the answer, not a
    // failure; anything else is.
    const out = await gitBytesOk(
      ["diff", "--no-index", "--", "x", "y"],
      { gitDir: dir, cwd: dir },
      [0, 1],
    );
    // The temporary pair's names appear in the headers; the book's paths
    // are what the teacher should see. Only the header prefixes are
    // rewritten — a path that itself contains "a/x/" is left alone, and
    // content lines are left as written. git's own spellings for added and
    // deleted files are a/y/… and b/x/…, so [xy] covers both.
    return out
      .toString("utf8")
      .split("\n")
      .map((line) =>
        line.startsWith("diff --git ")
          ? line
              .replace(/^diff --git a\/[xy]\//, "diff --git a/")
              .replace(/ b\/[xy]\//, " b/")
          : line.startsWith("--- ")
            ? line.replace(/^--- a\/[xy]\//, "--- a/")
            : line.startsWith("+++ ")
              ? line.replace(/^\+\+\+ b\/[xy]\//, "+++ b/")
              : line,
      )
      .join("\n")
      .trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** gitBytes for commands whose non-zero exit codes are answers. */
async function gitBytesOk(
  args: string[],
  options: RunOptions,
  ok: number[],
): Promise<Buffer> {
  const child = spawnGit(args, options);
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  child.stdout.on("data", (d: Buffer) => out.push(d));
  child.stderr.on("data", (d: Buffer) => err.push(d));
  child.stdin.end();
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (code === null || !ok.includes(code)) {
    throw new GitError(args, code, Buffer.concat(err).toString("utf8"));
  }
  return Buffer.concat(out);
}

export type Change =
  | { op: "write"; path: string; content: Buffer; baseOid: string | null }
  | { op: "delete"; path: string; baseOid: string }
  | { op: "move"; from: string; to: string; baseOid: string };

/** A change was made against an older version of a file, or does not fit the tree. */
export class ChangeConflictError extends Error {
  constructor(
    message: string,
    readonly paths: string[],
  ) {
    super(message);
    this.name = "ChangeConflictError";
  }
}

export class BookTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`The book would be larger than ${Math.round(maxBytes / 1024 / 1024)} MB`);
    this.name = "BookTooLargeError";
  }
}

const NO_OID = "0".repeat(40);
const RETRIES = 3;

/**
 * Applies `changes` to the branch's current tree as one commit. Every change
 * names the blob it was made against (`baseOid`; null for a new file), so a
 * save never overwrites what someone else saved in the meantime; saves of
 * other files by others are kept. Paths must have been checked by the caller.
 */
export async function commitChanges(
  repo: string,
  changes: Change[],
  options: { message: string; author: Identity; committer: Identity; maxBytes: number },
): Promise<{ commit: string; changed: boolean }> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await commitChangesOnce(repo, changes, options);
    } catch (error) {
      if (!(error instanceof ConcurrentChangeError) || attempt === RETRIES) throw error;
    }
  }
}

async function commitChangesOnce(
  repo: string,
  changes: Change[],
  options: { message: string; author: Identity; committer: Identity; maxBytes: number },
): Promise<{ commit: string; changed: boolean }> {
  const parent = await headCommit(repo);
  const files = new Map((parent ? await listTree(repo, parent) : []).map((e) => [e.path, e]));

  const stale = changes
    .filter((ch) => (files.get(ch.op === "move" ? ch.from : ch.path)?.oid ?? null) !== ch.baseOid)
    .map((ch) => (ch.op === "move" ? ch.from : ch.path));
  if (stale.length > 0) {
    throw new ChangeConflictError("Changed by someone else in the meantime", stale);
  }

  // The tree after the changes, as path → entry; blobs of new content are
  // written to the object store first.
  const next = new Map(files);
  for (const ch of changes) {
    if (ch.op === "write") {
      const oid = await git(["hash-object", "-w", "--stdin"], { gitDir: repo, input: ch.content });
      next.set(ch.path, { path: ch.path, oid, size: ch.content.length, mode: files.get(ch.path)?.mode ?? "100644" });
    } else if (ch.op === "delete") {
      next.delete(ch.path);
    } else {
      const entry = next.get(ch.from)!;
      next.delete(ch.from);
      if (next.has(ch.to)) throw new ChangeConflictError(`${ch.to} exists already`, [ch.to]);
      next.set(ch.to, { ...entry, path: ch.to });
    }
  }

  // A file and a folder cannot share a name.
  const clashes = [...next.keys()].filter((p) => {
    for (let i = p.indexOf("/"); i !== -1; i = p.indexOf("/", i + 1)) {
      if (next.has(p.slice(0, i))) return true;
    }
    return false;
  });
  if (clashes.length > 0) {
    throw new ChangeConflictError("A file and a folder would have the same name", clashes);
  }

  let total = 0;
  for (const e of next.values()) total += e.size;
  if (total > options.maxBytes) throw new BookTooLargeError(options.maxBytes);

  const index = path.join(repo, `index-${process.pid}-${Math.random().toString(36).slice(2)}`);
  const env = { GIT_INDEX_FILE: index };
  try {
    if (parent) await git(["read-tree", parent], { gitDir: repo, env });
    const lines: string[] = [];
    for (const p of files.keys()) if (!next.has(p)) lines.push(`0 ${NO_OID}\t${p}`);
    for (const e of next.values()) if (files.get(e.path)?.oid !== e.oid) lines.push(`${e.mode} ${e.oid}\t${e.path}`);
    await git(["update-index", "-z", "--index-info"], { gitDir: repo, env, input: lines.map((l) => l + "\0").join("") });
    const tree = await git(["write-tree"], { gitDir: repo, env });
    if (parent && (await git(["rev-parse", `${parent}^{tree}`], { gitDir: repo })) === tree) {
      return { commit: parent, changed: false };
    }
    const commit = await git(["commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", options.message], {
      gitDir: repo,
      env: {
        GIT_AUTHOR_NAME: options.author.name,
        GIT_AUTHOR_EMAIL: options.author.email,
        GIT_COMMITTER_NAME: options.committer.name,
        GIT_COMMITTER_EMAIL: options.committer.email,
      },
    });
    try {
      await git(["update-ref", BRANCH, commit, parent ?? ""], { gitDir: repo });
    } catch (error) {
      if (error instanceof GitError) throw new ConcurrentChangeError();
      throw error;
    }
    return { commit, changed: true };
  } finally {
    rmSync(index, { force: true });
  }
}

/*
 * Publish history lives in tags: v1, v2, … plus the moving "published" tag
 * (what the live site shows). Clients may fetch them but never create them
 * (the pre-receive hook rejects refs other than refs/heads/main).
 */

const VERSION_TAG = /^v\d+$/;
const PUBLISHED_TAG = "published";

/** Whether `name` is a tag this platform may write. */
export function isWritableTag(name: string): boolean {
  return name === PUBLISHED_TAG || VERSION_TAG.test(name);
}

/** All tags of the repo as name → commit (lightweight tags point at commits). */
export async function listTags(repo: string): Promise<{ name: string; commit: string }[]> {
  const out = await git(["for-each-ref", "--format=%(refname:short) %(objectname)", "refs/tags/"], {
    gitDir: repo,
  });
  if (!out) return [];
  return out.split("\n").map((line) => {
    const [name, commit] = line.split(" ");
    return { name: name!, commit: commit! };
  });
}

/** The commit a tag points at, or null when the tag does not exist. */
export async function resolveTagCommit(repo: string, name: string): Promise<string | null> {
  if (!isWritableTag(name)) return null;
  try {
    return await git(["rev-parse", "--verify", "--quiet", `refs/tags/${name}^{commit}`], {
      gitDir: repo,
    });
  } catch (error) {
    if (error instanceof GitError && error.code === 1) return null;
    throw error;
  }
}

/** Points a tag at a commit (lightweight tag). */
export async function setTag(repo: string, name: string, commit: string) {
  if (!isWritableTag(name)) throw new Error(`Not a writable tag: ${name}`);
  await git(["update-ref", `refs/tags/${name}`, commit], { gitDir: repo });
}

export async function deleteTag(repo: string, name: string) {
  if (!isWritableTag(name)) throw new Error(`Not a writable tag: ${name}`);
  await git(["update-ref", "-d", `refs/tags/${name}`], { gitDir: repo }).catch((error) => {
    // Deleting a tag that does not exist is fine.
    if (!(error instanceof GitError && error.code === 1)) throw error;
  });
}

/** The numbers of the existing v<N> tags. */
export async function versionTagNumbers(repo: string): Promise<number[]> {
  const tags = await listTags(repo).catch(() => [] as { name: string; commit: string }[]);
  return tags.filter((t) => VERSION_TAG.test(t.name)).map((t) => Number(t.name.slice(1)));
}

/** How many commits `to` has that `from` (null: no history) does not. */
export async function revListCount(repo: string, from: string | null, to: string): Promise<number> {
  const range = from ? `${from}..${to}` : to;
  return Number(await git(["rev-list", "--count", range], { gitDir: repo }));
}

/**
 * Parses the ref-update commands at the start of a receive-pack request
 * (pkt-lines "<old> <new> <ref>\0<capabilities>" up to the flush packet),
 * ignoring the pack data that follows.
 */
export function parseRefUpdates(body: Buffer): { old: string; new: string; ref: string }[] {
  const updates: { old: string; new: string; ref: string }[] = [];
  let pos = 0;
  while (pos + 4 <= body.length) {
    const len = Number.parseInt(body.toString("ascii", pos, pos + 4), 16);
    if (!Number.isInteger(len) || len < 4) break;
    if (len === 0) break; // flush packet
    const line = body.toString("utf8", pos + 4, pos + len).replace(/\0[\s\S]*$/, "").trim();
    const [old, newRef, ref] = line.split(" ");
    if (old && newRef && ref) updates.push({ old, new: newRef, ref });
    pos += len;
  }
  return updates;
}
