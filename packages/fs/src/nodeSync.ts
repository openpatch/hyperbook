/**
 * Node's synchronous file system, or null where there is none.
 *
 * Almost everything reads through the asynchronous interface in
 * ./filesystem. These two cases cannot, because they read while something
 * synchronous is already running: a handlebars helper, and a directive that
 * inlines the file its `src` points at. Both are given their content up front
 * where the host has no synchronous file system, and fall back to this.
 *
 * It is resolved through a guarded require rather than an import, so a bundle
 * for a browser does not carry Node's file system and this is simply null.
 */
export type SyncFileSystem = {
  readFileSync(path: string, encoding: "utf8"): string;
  readFileSync(path: string, encoding: "base64"): string;
  existsSync(path: string): boolean;
};

export const nodeSync: SyncFileSystem | null = (() => {
  try {
    // eslint-disable-next-line no-eval
    return eval("require")("fs") as SyncFileSystem;
  } catch {
    return null;
  }
})();
