import ReactMarkdown from "react-markdown";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkGemoji from "remark-gemoji";
import remarkUnwrapImages from "remark-unwrap-images";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { useDirectives } from "@hyperbook/provider";
import { Code } from "./Code";
import { Link } from "./Link";
import { Table, Td, Th, Tr } from "./Table";
import { Headings } from "./Headings";
import { Image } from "./Image";

import "./index.css";
import { remarkRemoveComments } from "./remarkRemoveComments";
import { remarkCustomHeadingIds } from "./remarkCustomHeadingIds";

export type MarkdownProps = {
  children: string;
};

export const Markdown = ({ children }: MarkdownProps) => {
  const directives = useDirectives();

  return (
    <ReactMarkdown
      className="hyperbook-markdown"
      components={{
        ...directives,
        a: Link,
        code: Code,
        td: Td,
        th: Th,
        table: Table,
        tr: Tr,
        h1: Headings,
        h2: Headings,
        h3: Headings,
        h4: Headings,
        h5: Headings,
        h6: Headings,
        img: Image,
      }}
      remarkPlugins={[
        remarkRemoveComments,
        remarkCustomHeadingIds,
        remarkDirective,
        remarkDirectiveRehype,
        remarkGfm,
        remarkMath,
        remarkGemoji,
        remarkUnwrapImages,
      ]}
      rehypePlugins={[
        rehypeKatex,
        [rehypeHighlight, { ignoreMissing: true, plainText: ["mermaid"] }],
      ]}
      skipHtml={false}
    >
      {children}
    </ReactMarkdown>
  );
};
