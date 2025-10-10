/**
 * Node.js filesystem adapter
 */
import fs from "fs/promises";
import fsSync from "fs";
import nodePath from "path";
import { FileSystemAdapter, PathAdapter, FileStats } from "./fs-adapter";

class NodeFileStats implements FileStats {
  constructor(private stats: fsSync.Stats) {}

  isDirectory(): boolean {
    return this.stats.isDirectory();
  }

  isFile(): boolean {
    return this.stats.isFile();
  }
}

export const nodeFileSystemAdapter: FileSystemAdapter = {
  async readFile(path: string, encoding?: BufferEncoding | null): Promise<any> {
    if (encoding === null) {
      return fs.readFile(path);
    }
    return fs.readFile(path, encoding || "utf8");
  },

  async writeFile(path: string, data: string | Buffer): Promise<void> {
    return fs.writeFile(path, data as any);
  },

  async readdir(path: string): Promise<string[]> {
    return fs.readdir(path);
  },

  async stat(path: string): Promise<FileStats> {
    const stats = await fs.stat(path);
    return new NodeFileStats(stats);
  },

  async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  },

  readFileSync(path: string, encoding?: BufferEncoding | null): any {
    if (encoding === null) {
      return fsSync.readFileSync(path);
    }
    return fsSync.readFileSync(path, encoding || "utf8");
  },

  writeFileSync(path: string, data: string | Buffer): void {
    fsSync.writeFileSync(path, data as any);
  },

  existsSync(path: string): boolean {
    return fsSync.existsSync(path);
  },

  rmSync(path: string): void {
    fsSync.rmSync(path);
  },
};

export const nodePathAdapter: PathAdapter = {
  join: nodePath.join.bind(nodePath),
  resolve: nodePath.resolve.bind(nodePath),
  relative: nodePath.relative.bind(nodePath),
  dirname: nodePath.dirname.bind(nodePath),
  basename: nodePath.basename.bind(nodePath),
  extname: nodePath.extname.bind(nodePath),
  parse: nodePath.parse.bind(nodePath),
  sep: nodePath.sep,
  posix: {
    join: nodePath.posix.join.bind(nodePath.posix),
  },
};
