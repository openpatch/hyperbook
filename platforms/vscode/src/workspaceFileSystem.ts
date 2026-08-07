import * as vscode from "vscode";
import { HyperbookFileSystem } from "@hyperbook/fs";

/**
 * Reads a hyperbook through the workspace of VS Code instead of through the
 * disk of the machine.
 *
 * On a desktop the two are the same thing. In VS Code for the Web there is no
 * disk: a repository is served over the network and only exists behind
 * `vscode.workspace.fs`, so this is the only way to read it there.
 *
 * The hyperbook packages work in paths, while VS Code works in URIs. A path is
 * turned back into a URI against the workspace folder it belongs to, so a
 * folder that is not a file keeps its own scheme.
 */
export const workspaceFileSystem: HyperbookFileSystem = {
  readFile: (path) =>
    Promise.resolve(vscode.workspace.fs.readFile(toUri(path))),

  readdir: async (path) =>
    (await vscode.workspace.fs.readDirectory(toUri(path))).map(
      ([name]) => name,
    ),

  stat: async (path) => {
    const stat = await vscode.workspace.fs.stat(toUri(path));
    return {
      isDirectory: (stat.type & vscode.FileType.Directory) !== 0,
      isFile: (stat.type & vscode.FileType.File) !== 0,
    };
  },
};

/**
 * The URI a path belongs to. A path that came from a workspace folder is put
 * back on that folder, so its scheme and authority survive the round trip
 * through the hyperbook packages.
 */
export const toUri = (path: string): vscode.Uri => {
  const normalized = path.replace(/\\/g, "/");

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const root = folder.uri.path.replace(/\/$/, "");
    if (normalized === root || normalized.startsWith(`${root}/`)) {
      return folder.uri.with({ path: normalized });
    }
  }

  // Outside every workspace folder. On a desktop that is a file on the disk,
  // which is what a hyperbook opened as a single folder looks like.
  return vscode.Uri.file(normalized);
};

/**
 * The path of a resource, for handing it to the hyperbook packages.
 *
 * `fsPath` is the wrong answer on the web: a URI that is not a file has no
 * path on a disk, and asking for one gives something that cannot be read back.
 */
export const toPath = (uri: vscode.Uri): string => uri.path;
