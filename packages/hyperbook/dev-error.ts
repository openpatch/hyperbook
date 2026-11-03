import path from "path";
import http from "http";

/**
 * Renders a build failure as the plain text shown in the browser.
 * Mirrors what `reportError` prints to the terminal, minus the colour codes.
 */
export function formatErrorForBrowser(e: unknown): string {
  const message = e as {
    reason?: string;
    file?: string;
    line?: number | null;
    column?: number | null;
  };

  if (message && typeof message.reason === "string") {
    const where = [message.file, message.line, message.column]
      .filter((part) => part !== undefined && part !== null)
      .join(":");
    return where ? `${where}\n${message.reason}` : message.reason;
  }

  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Whether a missing resource is a page the reader navigated to rather than an
 * asset some page asked for. An image or a bundle wants its 404: a stylesheet
 * that suddenly parses as HTML helps nobody.
 */
export function isDocumentRequest(
  request: http.IncomingMessage,
  pathname: string,
): boolean {
  const accept = request.headers.accept || "";
  if (!accept.includes("text/html") && !accept.includes("*/*")) return false;
  const extension = path.extname(pathname);
  return extension === "" || extension === ".html";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A stand-in page for one that failed. The dev server adds its client to it
 * like to any page, so it reconnects and reloads itself on the next change —
 * the author never has to restart the server or remember the URL.
 */
export function renderErrorPage(heading: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        padding: 2rem;
        background: #141414;
        color: #f7f7f7;
        font: 14px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
      h1 { color: #ff6b6b; font-size: 1.1rem; margin: 0 0 1rem; }
      pre { white-space: pre-wrap; word-break: break-word; margin: 0; }
      p { margin-top: 1.5rem; opacity: 0.6; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(heading)}</h1>
    <pre>${escapeHtml(message)}</pre>
    <p>Fix the file and save — this page reloads by itself.</p>
  </body>
</html>
`;
}
