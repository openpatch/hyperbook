/**
 * The file system a hyperbook is read through.
 *
 * Reading a hyperbook is the only part of this package that touches files, so
 * it goes through this interface. On a machine that is Node, and in VS Code for
 * the Web it can be the workspace file system, which reads a repository that is
 * never on disk.
 *
 * Only reading is here. Writing a build output stays with the builder, which
 * runs on Node.
 */
export type HyperbookFileSystem = {
  /** Reads a file. Rejects when it does not exist. */
  readFile(path: string): Promise<Uint8Array>;
  /** Lists the names in a directory, without their path. */
  readdir(path: string): Promise<string[]>;
  /** Rejects when the path does not exist. */
  stat(path: string): Promise<{ isDirectory: boolean; isFile: boolean }>;
};

let current: HyperbookFileSystem | null = null;

/** Reads a hyperbook through this file system from now on. */
export const useFileSystem = (fileSystem: HyperbookFileSystem): void => {
  current = fileSystem;
};

/**
 * The file system in use. Without one, Node's is loaded on first use, so a
 * build keeps working without knowing this interface exists. The import is
 * dynamic, so a bundle for a browser does not carry Node's file system as long
 * as the host installs its own first.
 */
export const getFileSystem = async (): Promise<HyperbookFileSystem> => {
  if (!current) {
    current = (await import("./nodeFileSystem")).nodeFileSystem;
  }
  return current;
};

export const readFile = async (path: string): Promise<Uint8Array> =>
  (await getFileSystem()).readFile(path);

export const readdir = async (path: string): Promise<string[]> =>
  (await getFileSystem()).readdir(path);

export const stat = async (
  path: string,
): Promise<{ isDirectory: boolean; isFile: boolean }> =>
  (await getFileSystem()).stat(path);

/** Reads a file as text, which is what almost every caller wants. */
export const readText = async (path: string): Promise<string> =>
  new TextDecoder().decode(await readFile(path));

/** Whether a path exists, for the callers that only branch on it. */
export const exists = async (path: string): Promise<boolean> =>
  stat(path)
    .then(() => true)
    .catch(() => false);

/**
 * Walks up from a directory looking for a name, the way find-up does. It is
 * implemented here so it goes through the file system above instead of
 * reaching for Node.
 */
export const findUp = async (
  name: string,
  cwd: string,
): Promise<string | undefined> => {
  let directory = cwd;

  while (true) {
    const candidate = join(directory, name);
    if (await exists(candidate)) {
      return candidate;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      return undefined;
    }
    directory = parent;
  }
};

/**
 * The path helpers of this module, kept separate from Node's `path` so the
 * lookup above works in a browser too. Hyperbook paths are posix.
 */
const join = (directory: string, name: string): string =>
  directory.endsWith("/") ? `${directory}${name}` : `${directory}/${name}`;

const dirname = (p: string): string => {
  const at = p.replace(/\/+$/, "").lastIndexOf("/");
  if (at < 0) return p;
  if (at === 0) return "/";
  return p.slice(0, at);
};
