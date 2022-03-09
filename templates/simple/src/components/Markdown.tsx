import ReactMarkdown from "react-markdown";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkGemoji from "remark-gemoji";
import remarkHint from "remark-hint";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import directives from "../components/Directives";
import { Headings } from "./Headings";

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
        remarkGemoji,
        remarkHint,
      ]}
      skipHtml={false}
      components={
        {
          ...directives,
          h1: Headings,
          h2: Headings,
          h3: Headings,
          h4: Headings,
          h5: Headings,
          h6: Headings,
        } as any
      }
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
    />
  );
};
