import * as vscode from "vscode";

/**
 * Creating a hyperbook writes a folder full of files, which the web extension
 * host cannot do. The command is hidden in a virtual workspace, so this only
 * runs if it is reached some other way.
 */
export const createNewHyperbook = async (): Promise<void> => {
  await vscode.window.showInformationMessage(
    "Creating a hyperbook needs a folder on your machine. Open this workspace in VS Code on your desktop, or clone it first.",
  );
};
