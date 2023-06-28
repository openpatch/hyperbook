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
import { useRemarkSync } from "./useRemarkSync";

export type MarkdownProps = {
  children: string;
};

export const Markdown = ({ children }: MarkdownProps) => {
  const directives = useDirectives();

  const reactContent = useRemarkSync(children, {
    rehypeReactOptions: {
      passNode: true,
      components: {
        ...directives,
        a: Link,
        code: Code,
        td: Td,
        th: Th,
        table: Table,
        tr: Tr,
        h1: Headings(1),
        h2: Headings(2),
        h3: Headings(3),
        h4: Headings(4),
        h5: Headings(5),
        h6: Headings(6),
        img: Image,
      },
    },
    remarkPlugins: [
      remarkRemoveComments,
      remarkCustomHeadingIds,
      remarkGfm,
      remarkDirective,
      remarkDirectiveRehype,
      remarkMath,
      remarkGemoji,
      remarkUnwrapImages,
    ],
    rehypePlugins: [
      rehypeKatex,
      [rehypeHighlight, { ignoreMissing: true, plainText: ["mermaid"] }],
    ],
  });

  return <div className="hyperbook-markdown">{reactContent}</div>;
};
