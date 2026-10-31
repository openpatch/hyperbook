import { renderSafeMarkdown } from "../../shared/safe-markdown";

/*
 * Imprint and privacy policy written by the admin as Markdown, rendered and
 * made safe by the shared pipeline (shared/safe-markdown.ts) — the same one
 * the editor uses for the AI's answers.
 */

export function renderLegalMarkdown(markdown: string): string {
  return renderSafeMarkdown(markdown);
}
