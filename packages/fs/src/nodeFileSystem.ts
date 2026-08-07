import fs from "fs/promises";

import { HyperbookFileSystem } from "./filesystem";

/**
 * Reading a hyperbook from disk. This is the only module of the package that
 * imports Node's file system, so a bundle for a browser can leave it out and
 * install its own instead.
 */
export const nodeFileSystem: HyperbookFileSystem = {
  readFile: (path) =>
    fs.readFile(path).then((buffer) => new Uint8Array(buffer)),
  readdir: (path) => fs.readdir(path),
  stat: (path) =>
    fs.stat(path).then((stat) => ({
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
    })),
};
