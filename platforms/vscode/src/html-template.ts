import * as vscode from "vscode";

export const htmlTemplate = (
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel
) => {
  const nonce = getNonce();
  const bundleScriptPath = panel.webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "out", "app", "bundle.js")
  );
  return `<!doctype html>
            <html lang="en">
            <head>
                <meta http-equiv="Content-Security-Policy" content="
default-src *  data: blob: filesystem: about: ws: wss: 'unsafe-inline' 'unsafe-eval' 'unsafe-dynamic';
script-src * data: blob: 'unsafe-inline' 'unsafe-eval';
connect-src * data: blob: 'unsafe-inline';
img-src * data: blob: 'unsafe-inline';
frame-src * data: blob: ;
style-src * data: blob: 'unsafe-inline';
font-src * data: blob: 'unsafe-inline';
frame-ancestors * data: blob: 'unsafe-inline';
">
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
                <style>
                html, body {
                  background-color: var(--color-background);
                  margin: 0;
                  padding: 0;
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
