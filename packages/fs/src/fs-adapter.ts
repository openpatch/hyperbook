/**
 * Filesystem abstraction layer for cross-platform compatibility
 * Supports both Node.js and VS Code Web environments
 */

export interface FileSystemAdapter {
  // Async operations
  readFile(path: string, encoding?: BufferEncoding): Promise<string>;
  readFile(path: string, encoding: null): Promise<Buffer>;
  writeFile(path: string, data: string | Buffer): Promise<void>;
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<FileStats>;
  exists(path: string): Promise<boolean>;

  // Sync operations (may not be available in all environments)
  readFileSync(path: string, encoding?: BufferEncoding): string;
  readFileSync(path: string, encoding: null): Buffer;
  writeFileSync(path: string, data: string | Buffer): void;
  existsSync(path: string): boolean;
  rmSync?(path: string): void;  // Optional, for cleanup operations
}

export interface FileStats {
  isDirectory(): boolean;
  isFile(): boolean;
}

export interface PathAdapter {
  join(...paths: string[]): string;
  resolve(...paths: string[]): string;
  relative(from: string, to: string): string;
  dirname(path: string): string;
  basename(path: string, ext?: string): string;
  extname(path: string): string;
  parse(path: string): { dir: string; name: string; ext: string; base: string; root: string };
  sep: string;
  posix: {
    join(...paths: string[]): string;
  };
}

let currentFsAdapter: FileSystemAdapter | null = null;
let currentPathAdapter: PathAdapter | null = null;

export function setFileSystemAdapter(adapter: FileSystemAdapter) {
  currentFsAdapter = adapter;
}

export function setPathAdapter(adapter: PathAdapter) {
  currentPathAdapter = adapter;
}

export function getFileSystemAdapter(): FileSystemAdapter {
  if (!currentFsAdapter) {
    throw new Error('FileSystem adapter not initialized. Call setFileSystemAdapter() first.');
  }
  return currentFsAdapter;
}

export function getPathAdapter(): PathAdapter {
  if (!currentPathAdapter) {
    throw new Error('Path adapter not initialized. Call setPathAdapter() first.');
  }
  return currentPathAdapter;
}
