import { useMemo } from "react";
import { renderSafeMarkdown } from "../../shared/safe-markdown";

/**
 * Renders untrusted Markdown — the AI assistant's answers — as safe HTML:
 * raw HTML is escaped, links keep to safe protocols (shared/safe-markdown).
 */
export function Markdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const html = useMemo(() => renderSafeMarkdown(text), [text]);
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
