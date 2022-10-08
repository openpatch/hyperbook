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
import { visit, SKIP } from "unist-util-visit";
import { Code } from "./Code";
import { Link } from "./Link";
import { Table, Td, Th, Tr } from "./Table";
import { Headings } from "./Headings";
import { Image } from "./Image";

import "./index.css";
import { Transformer } from "unified";
import { BuildVisitor } from "unist-util-visit/complex-types";

const remarkRemoveComments: () => Transformer = () => (tree) => {
  const htmlCommentRegex = /<!--([\s\S]*?)-->/g;

  const handler: BuildVisitor = (node, index, parent) => {
    const isComment = node.value.match(htmlCommentRegex);

    if (isComment) {
      // remove node
      parent.children.splice(index, 1);
      // Do not traverse `node`, continue at the node *now* at `index`. http://unifiedjs.com/learn/recipe/remove-node/
      return [SKIP, index];
    }
  };

  visit(tree, "html", handler);

  visit(tree, "jsx", handler);
};

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
