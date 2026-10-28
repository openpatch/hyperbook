import { Marked, type Tokens } from "marked";

/*
 * Imprint and privacy policy written in the admin's settings as Markdown.
 * The admin is trusted, but the pages are shown on the admin origin, so the
 * HTML stays harmless anyway: raw HTML is shown as text, and links and images
 * keep to http(s), mailto and paths on this site.
 */

const escape = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^(https?:|mailto:)/i.test(trimmed) || /^\/(?!\/)/.test(trimmed) || trimmed.startsWith("#")) return trimmed;
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

export function renderLegalMarkdown(markdown: string): string {
  return marked.parse(markdown, { async: false });
}
