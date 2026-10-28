import { mkdirSync, rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import type { Config } from "../config";

/*
 * Everything a book stores on disk, by book id so renaming a slug moves
 * nothing:
 *
 *   $DATA_DIR/books/<bookId>/repo.git/          bare repository (the source)
 *   $DATA_DIR/books/<bookId>/builds/<buildId>/  a finished build
 *   $DATA_DIR/tmp/                              one directory per running job
 *
 * tmp/ is on the data volume, so a finished build moves into place with one
 * rename instead of a copy.
 */

export function bookDir(config: Config, bookId: number): string {
  return path.join(config.dataDir, "books", String(bookId));
}

export function repoDir(config: Config, bookId: number): string {
  return path.join(bookDir(config, bookId), "repo.git");
}

export function buildsDir(config: Config, bookId: number): string {
  return path.join(bookDir(config, bookId), "builds");
}

export function buildDir(config: Config, bookId: number, buildId: number): string {
  return path.join(buildsDir(config, bookId), String(buildId));
}

function tmpRoot(config: Config): string {
  return path.join(config.dataDir, "tmp");
}

/** A fresh, empty directory for one job. The caller removes it. */
export async function makeJobDir(config: Config, prefix: string): Promise<string> {
  const root = tmpRoot(config);
  mkdirSync(root, { recursive: true });
  return mkdtemp(path.join(root, `${prefix}-`));
}

/** Leftovers of jobs a crash or restart interrupted. Run at startup only. */
export function clearTmp(config: Config) {
  rmSync(tmpRoot(config), { recursive: true, force: true });
  mkdirSync(tmpRoot(config), { recursive: true });
}

export async function removeBookFiles(config: Config, bookId: number) {
  await rm(bookDir(config, bookId), { recursive: true, force: true });
}
