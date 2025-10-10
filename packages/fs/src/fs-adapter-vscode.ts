/**
 * VS Code Web filesystem adapter
 * Uses vscode.workspace.fs API for browser-compatible file operations
 */
import { FileSystemAdapter, PathAdapter, FileStats } from "./fs-adapter";

// These will be provided by the VS Code extension context
let vscodeWorkspaceFs: any = null;
let vscodeUri: any = null;

export function setVSCodeWorkspaceFs(fs: any, Uri?: any) {
  vscodeWorkspaceFs = fs;
  if (Uri) {
    vscodeUri = Uri;
  }
}

class VSCodeFileStats implements FileStats {
  constructor(private type: number) {}

  isDirectory(): boolean {
    // FileType.Directory = 2
    return this.type === 2;
  }

  isFile(): boolean {
    // FileType.File = 1
    return this.type === 1;
  }
}

function uriFromPath(path: string): any {
  if (!vscodeWorkspaceFs) {
    throw new Error('VS Code workspace.fs not initialized');
  }
  // Use vscode.Uri if available, otherwise create a simple object
  if (vscodeUri && vscodeUri.file) {
    return vscodeUri.file(path);
  }
  // Fallback for simple path handling
  return { fsPath: path, path };
}

export const vscodeFileSystemAdapter: FileSystemAdapter = {
  async readFile(path: string, encoding?: BufferEncoding | null): Promise<any> {
    if (!vscodeWorkspaceFs) {
      throw new Error('VS Code workspace.fs not initialized');
    }
    
    const uri = uriFromPath(path);
    const buffer = await vscodeWorkspaceFs.readFile(uri);
    
    if (encoding === null) {
      return buffer;
    }
    
    const decoder = new TextDecoder(encoding || 'utf-8');
    return decoder.decode(buffer);
  },

  async writeFile(path: string, data: string | Buffer): Promise<void> {
    if (!vscodeWorkspaceFs) {
      throw new Error('VS Code workspace.fs not initialized');
    }
    
    const uri = uriFromPath(path);
    const buffer = typeof data === 'string' 
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
    
    return vscodeWorkspaceFs.writeFile(uri, buffer);
  },

  async readdir(path: string): Promise<string[]> {
    if (!vscodeWorkspaceFs) {
      throw new Error('VS Code workspace.fs not initialized');
    }
    
    const uri = uriFromPath(path);
    const entries = await vscodeWorkspaceFs.readDirectory(uri);
    return entries.map(([name]: [string, number]) => name);
  },

  async stat(path: string): Promise<FileStats> {
    if (!vscodeWorkspaceFs) {
      throw new Error('VS Code workspace.fs not initialized');
    }
    
    const uri = uriFromPath(path);
    const stat = await vscodeWorkspaceFs.stat(uri);
    return new VSCodeFileStats(stat.type);
  },

  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch {
      return false;
    }
  },

  readFileSync(path: string, encoding?: BufferEncoding | null): any {
    // Sync operations are not available in VS Code Web
    throw new Error('Synchronous file operations are not supported in VS Code Web environment');
  },

  writeFileSync(path: string, data: string | Buffer): void {
    // Sync operations are not available in VS Code Web
    throw new Error('Synchronous file operations are not supported in VS Code Web environment');
  },

  existsSync(path: string): boolean {
    // Sync operations are not available in VS Code Web
    throw new Error('Synchronous file operations are not supported in VS Code Web environment');
  },

  rmSync(path: string): void {
    // Sync operations are not available in VS Code Web
    throw new Error('Synchronous file operations are not supported in VS Code Web environment');
  },
};

// Path utilities for web (browser-compatible)
export const vscodePathAdapter: PathAdapter = {
  join(...paths: string[]): string {
    const normalized = paths
      .filter(p => p && p.length > 0)
      .join('/')
      .replace(/\/+/g, '/');
    return normalized;
  },

  resolve(...paths: string[]): string {
    let resolvedPath = '';
    
    for (let i = paths.length - 1; i >= 0; i--) {
      const path = paths[i];
      if (!path || path.length === 0) continue;
      
      if (path.startsWith('/')) {
        resolvedPath = path;
        break;
      }
      
      resolvedPath = path + (resolvedPath ? '/' + resolvedPath : '');
    }
    
    return resolvedPath || '/';
  },

  relative(from: string, to: string): string {
    from = from.replace(/\\/g, '/');
    to = to.replace(/\\/g, '/');
    
    const fromParts = from.split('/').filter(p => p);
    const toParts = to.split('/').filter(p => p);
    
    let i = 0;
    while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
      i++;
    }
    
    const upCount = fromParts.length - i;
    const relativeParts = Array(upCount).fill('..');
    const remainingParts = toParts.slice(i);
    
    return [...relativeParts, ...remainingParts].join('/');
  },

  dirname(path: string): string {
    path = path.replace(/\\/g, '/');
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) return '.';
    if (lastSlash === 0) return '/';
    return path.substring(0, lastSlash);
  },

  basename(path: string, ext?: string): string {
    path = path.replace(/\\/g, '/');
    const lastSlash = path.lastIndexOf('/');
    let base = lastSlash === -1 ? path : path.substring(lastSlash + 1);
    
    if (ext && base.endsWith(ext)) {
      base = base.substring(0, base.length - ext.length);
    }
    
    return base;
  },

  extname(path: string): string {
    path = path.replace(/\\/g, '/');
    const lastDot = path.lastIndexOf('.');
    const lastSlash = path.lastIndexOf('/');
    
    if (lastDot === -1 || lastDot < lastSlash) return '';
    
    return path.substring(lastDot);
  },

  parse(path: string): { dir: string; name: string; ext: string; base: string; root: string } {
    path = path.replace(/\\/g, '/');
    const lastSlash = path.lastIndexOf('/');
    const lastDot = path.lastIndexOf('.');
    
    const dir = lastSlash === -1 ? '' : path.substring(0, lastSlash);
    const base = lastSlash === -1 ? path : path.substring(lastSlash + 1);
    const ext = (lastDot !== -1 && lastDot > lastSlash) ? path.substring(lastDot) : '';
    const name = ext ? base.substring(0, base.length - ext.length) : base;
    const root = path.startsWith('/') ? '/' : '';
    
    return { dir, name, ext, base, root };
  },

  sep: '/',

  posix: {
    join(...paths: string[]): string {
      return paths
        .filter(p => p && p.length > 0)
        .join('/')
        .replace(/\/+/g, '/');
    },
  },
};
