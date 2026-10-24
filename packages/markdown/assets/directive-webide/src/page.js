/**
 * Turns a webide workspace into the document shown in the iframe.
 *
 * The main file (index.html) links the other files by their paths, as it
 * would on a web server. Those links are pointed at blob URLs of the files'
 * current contents, so `<link href="style.css">` and `<script src="app.js">`
 * work without one.
 */

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".xml": "application/xml",
};

const mimeType = (path) => {
  const dot = path.lastIndexOf(".");
  return (dot >= 0 && MIME_TYPES[path.slice(dot).toLowerCase()]) || "text/plain";
};

/** `./style.css` and `style.css` name the same file. */
const normalize = (path) => path.replace(/^\.\//, "");

/**
 * Builds the page.
 *
 * @param {{path: string, content?: string, url?: string}[]} files
 * @param {string} main
 * @param {(blob: Blob) => string} createUrl Usually URL.createObjectURL.
 * @returns {{html: string, urls: string[]}} The document, and the blob URLs
 *   it uses, for the caller to revoke once the next version is shown.
 */
export const buildPage = (files, main, createUrl) => {
  const urls = [];
  const byPath = new Map();
  for (const file of files) {
    // A solution or target is for comparing, not part of the reader's page.
    if (file.path === main || file.role) continue;
    if (typeof file.content === "string") {
      const url = createUrl(
        new Blob([file.content], { type: mimeType(file.path) }),
      );
      urls.push(url);
      byPath.set(file.path, url);
    } else if (typeof file.url === "string") {
      byPath.set(file.path, file.url);
    }
  }

  const source = files.find((file) => file.path === main)?.content ?? "";
  const html = source.replace(
    /\b(src|href)(\s*=\s*)(["'])([^"']*)\3/gi,
    (match, attribute, equals, quote, value) => {
      const url = byPath.get(normalize(value));
      return url ? `${attribute}${equals}${quote}${url}${quote}` : match;
    },
  );
  return { html, urls };
};
