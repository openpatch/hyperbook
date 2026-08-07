/**
 * The build caches the directory listing of a hyperbook next to it, behind the
 * HYPERBOOK_CACHE environment variable. That is a Node concern: it writes, and
 * a host that only reads a workspace has nowhere to put it.
 *
 * Node's file system is loaded when a cache is actually used, so a bundle for a
 * browser does not carry it. Without a cache every function here does nothing,
 * and reading a hyperbook works exactly the same, only without the shortcut.
 */
const enabled = (): boolean =>
  typeof process !== "undefined" && !!process.env?.HYPERBOOK_CACHE;

const nodeFs = async () => {
  try {
    return await import("fs");
  } catch {
    return null;
  }
};

/** The cached value under this path, or undefined when there is none. */
export const read = async <T>(path: string): Promise<T | undefined> => {
  if (!enabled()) return undefined;
  const fs = await nodeFs();
  if (!fs?.existsSync(path)) return undefined;
  return JSON.parse(fs.readFileSync(path, "utf8")) as T;
};

export const write = async (path: string, value: unknown): Promise<void> => {
  if (!enabled()) return;
  const fs = await nodeFs();
  fs?.writeFileSync(path, JSON.stringify(value));
};

/** Drops a cached value. Used by the builder, so it never reads a stale one. */
export const remove = async (path: string): Promise<void> => {
  const fs = await nodeFs();
  if (fs?.existsSync(path)) {
    fs.rmSync(path);
  }
};
