import { Marked, type Tokens } from "marked";

/*
 * Markdown from sources nobody vetted element by element: the admin's legal
 * pages on one hand, the AI assistant's answers on the other. The HTML stays
 * harmless either way: raw HTML is shown as text, and links and images keep
 * to http(s), mailto and paths on this site.
 */

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (
    /^(https?:|mailto:)/i.test(trimmed) ||
    /^\/(?!\/)/.test(trimmed) ||
    trimmed.startsWith("#")
  )
    return trimmed;
  return null;
}

const marked = new Marked({
  gfm: true,
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escape(text);
    },
    link({ href, title, tokens }: Tokens.Link) {
      const text = this.parser.parseInline(tokens);
      const safe = safeHref(href);
      if (!safe) return text;
      return `<a href="${escape(safe)}"${title ? ` title="${escape(title)}"` : ""}>${text}</a>`;
    },
    image({ href, title, text }: Tokens.Image) {
      const safe = safeHref(href);
      if (!safe || safe.startsWith("mailto:")) return escape(text);
      return `<img src="${escape(safe)}" alt="${escape(text)}"${title ? ` title="${escape(title)}"` : ""}>`;
    },
  },
});

export function renderSafeMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false });
}
