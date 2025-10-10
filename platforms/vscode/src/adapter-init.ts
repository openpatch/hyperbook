/**
 * Filesystem adapter initialization for VS Code extension
 * Detects runtime environment and initializes appropriate adapters
 */
import * as vscode from 'vscode';
import {
  setFileSystemAdapter,
  setPathAdapter,
  nodeFileSystemAdapter,
  nodePathAdapter,
  vscodeFileSystemAdapter,
  vscodePathAdapter,
  setVSCodeWorkspaceFs,
} from '@hyperbook/fs';

/**
 * Detects if the extension is running in a web environment (browser)
 * vs Node.js environment (desktop VS Code)
 */
export function isWebEnvironment(): boolean {
  // In web environment, vscode.env.uiKind is UIKind.Web
  return vscode.env.uiKind === vscode.UIKind.Web;
}

/**
 * Initialize filesystem and path adapters based on the runtime environment
 * Must be called early in the extension activation
 */
export function initializeAdapters(): void {
  if (isWebEnvironment()) {
    console.log('Hyperbook: Initializing VS Code Web filesystem adapter');
    
    // Initialize VS Code Web adapter with workspace.fs and Uri
    setVSCodeWorkspaceFs(vscode.workspace.fs, vscode.Uri);
    setFileSystemAdapter(vscodeFileSystemAdapter);
    setPathAdapter(vscodePathAdapter);
  } else {
    console.log('Hyperbook: Initializing Node.js filesystem adapter');
    
    // Initialize Node.js adapter
    setFileSystemAdapter(nodeFileSystemAdapter);
    setPathAdapter(nodePathAdapter);
  }
}
