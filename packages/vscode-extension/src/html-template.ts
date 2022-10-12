import * as vscode from "vscode";
import { ChangeMessage } from "./messages/messageTypes";

export const htmlTemplate = (
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  state: ChangeMessage["payload"],
  config: Record<string, any>
) => {
  const nonce = getNonce();
  const bundleScriptPath = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "out", "app", "bundle.js")
  );
  const initialState = Buffer.from(JSON.stringify(state)).toString("base64");
  const initialConfig = Buffer.from(JSON.stringify(config)).toString("base64");
  return `<!doctype html>
            <html lang="en">
            <head>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http: https:; img-src ${
                  panel.webview.cspSource
                } 'self' 'unsafe-inline' data: *; script-src * 'nonce-${nonce}' 'unsafe-eval'; style-src ${
    panel.webview.cspSource
  } 'self' 'unsafe-inline'; font-src ${
    panel.webview.cspSource
  }; connect-src *;">
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
                <style>
                html, body {
                  width: 100%;
                  height: 100%;
                  background-color: var(--color-background);
                  max-width: 980px;
                  margin: 0 auto;
                  line-height: 1.5;
                }
                </style>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}">
                  window.EXCALIDRAW_ASSET_PATH = "${
                    panel.webview.asWebviewUri(
                      vscode.Uri.joinPath(
                        context.extensionUri,
                        "assets",
                        "excalidraw"
                      )
                    ) + "/"
                  }"
                  window.vscode = acquireVsCodeApi();
                  window.workspacePath = "${panel.webview.asWebviewUri(
                    vscode.Uri.file(vscode.workspace?.rootPath || "")
                  )}";
                  window.initialState = JSON.parse(atob("${initialState}"));
                  window.initialConfig = JSON.parse(atob("${initialConfig}"));
                </script>
                <script nonce="${nonce}" src="${bundleScriptPath}"></script>
            </body>
        </html>`;
};

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
