import path from "path";
import fs from "fs/promises";

export interface CopyOptions {
  /** Called with every source path, the root included; false skips it. */
  filter?: (src: string) => boolean;
}

/**
 * Copies a file or a directory tree, creating missing parent directories of
 * the destination and replacing existing files.
 *
 * Used instead of `fs.cp`, which stats every parent directory of the
 * destination up to `/`. That fails under Node's permission model when a
 * build may only read its own directory, as in Hyperbook Cloud.
 */
export async function copy(
  src: string,
  dest: string,
  options: CopyOptions = {},
): Promise<void> {
  if (options.filter && !options.filter(src)) return;
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    for (const entry of await fs.readdir(src)) {
      await copy(path.join(src, entry), path.join(dest, entry), options);
    }
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
}
