import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";

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

function spawnGit(args: string[], options: RunOptions) {
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

/** Creates the bare repository unless it exists. */
export async function initRepo(repo: string) {
  mkdirSync(repo, { recursive: true });
  // An empty template: no sample hooks, no info/exclude.
  await git(["init", "--bare", "--quiet", "--template=", "--initial-branch=main"], {
    gitDir: repo,
  });
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
