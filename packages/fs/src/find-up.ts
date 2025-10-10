/**
 * Custom find-up implementation for Hyperbook
 * Searches for a file or directory by walking up parent directories
 * Uses the filesystem adapter for cross-platform compatibility
 */

import { getFileSystemAdapter, getPathAdapter } from "./fs-adapter";

export interface FindUpOptions {
  cwd?: string;
  type?: "file" | "directory";
}

/**
 * Asynchronously find a file or directory by walking up parent directories
 * @param name - The name of the file or directory to find
 * @param options - Options for the search
 * @returns The absolute path to the found file/directory, or undefined if not found
 */
export async function findUp(
  name: string,
  options: FindUpOptions = {}
): Promise<string | undefined> {
  const fs = getFileSystemAdapter();
  const path = getPathAdapter();
  
  const { cwd = process.cwd(), type } = options;
  let currentDir = path.resolve(cwd);
  
  // Keep track of visited directories to avoid infinite loops
  const visited = new Set<string>();
  
  while (true) {
    // Avoid infinite loops
    if (visited.has(currentDir)) {
      return undefined;
    }
    visited.add(currentDir);
    
    const candidatePath = path.join(currentDir, name);
    
    try {
      const stat = await fs.stat(candidatePath);
      
      // Check if the type matches (if specified)
      if (type === "file" && stat.isFile()) {
        return candidatePath;
      } else if (type === "directory" && stat.isDirectory()) {
        return candidatePath;
      } else if (!type) {
        // If no type specified, return any match
        return candidatePath;
      }
    } catch (error) {
      // File/directory doesn't exist at this level, continue searching
    }
    
    // Move to parent directory
    const parentDir = path.dirname(currentDir);
    
    // If we've reached the root (parent is same as current), stop
    if (parentDir === currentDir) {
      return undefined;
    }
    
    currentDir = parentDir;
  }
}

/**
 * Synchronously find a file or directory by walking up parent directories
 * @param name - The name of the file or directory to find
 * @param options - Options for the search
 * @returns The absolute path to the found file/directory, or undefined if not found
 */
export function findUpSync(
  name: string,
  options: FindUpOptions = {}
): string | undefined {
  const fs = getFileSystemAdapter();
  const path = getPathAdapter();
  
  const { cwd = process.cwd(), type } = options;
  let currentDir = path.resolve(cwd);
  
  // Keep track of visited directories to avoid infinite loops
  const visited = new Set<string>();
  
  while (true) {
    // Avoid infinite loops
    if (visited.has(currentDir)) {
      return undefined;
    }
    visited.add(currentDir);
    
    const candidatePath = path.join(currentDir, name);
    
    try {
      // Check if file/directory exists
      if (!fs.existsSync(candidatePath)) {
        // Move to parent directory
        const parentDir = path.dirname(currentDir);
        
        // If we've reached the root (parent is same as current), stop
        if (parentDir === currentDir) {
          return undefined;
        }
        
        currentDir = parentDir;
        continue;
      }
      
      // For sync operations, we need to determine if it's a file or directory
      // We can do this by trying to read it as a directory
      if (type === "file") {
        // For file type, we just check existence (already done above)
        return candidatePath;
      } else if (type === "directory") {
        // For directory type, try to read it as a directory
        try {
          fs.readFileSync(candidatePath, "utf8");
          // If readFile succeeds, it's a file, not a directory
          // Move to parent
          const parentDir = path.dirname(currentDir);
          if (parentDir === currentDir) {
            return undefined;
          }
          currentDir = parentDir;
          continue;
        } catch (e) {
          // If readFile fails, it might be a directory
          // This is a heuristic - in sync mode, we have limited options
          return candidatePath;
        }
      } else {
        // If no type specified, return any match
        return candidatePath;
      }
    } catch (error) {
      // File/directory doesn't exist at this level, continue searching
      const parentDir = path.dirname(currentDir);
      
      // If we've reached the root (parent is same as current), stop
      if (parentDir === currentDir) {
        return undefined;
      }
      
      currentDir = parentDir;
    }
  }
}
