import ReactMarkdown from "react-markdown";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkEmoji from "remark-emoji";
import remarkHint from "remark-hint";
import rehypeKatex from "rehype-katex";

export type MarkdownProps = {
  children: string;
};

export const Markdown = (props: MarkdownProps) => {
  return (
    <ReactMarkdown
      {...props}
      remarkPlugins={[
        remarkDirective,
        remarkDirectiveRehype,
        remarkGfm,
        remarkMath,
        remarkEmoji,
        remarkHint,
      ]}
      rehypePlugins={[rehypeKatex]}
    />
  );
};
