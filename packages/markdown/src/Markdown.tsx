import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkGemoji from "remark-gemoji";
import remarkUnwrapImages from "remark-unwrap-images";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { useDirectives } from "@hyperbook/provider";
import { Drawer } from "@hyperbook/drawer";
import { Code } from "./Code";
import { Link } from "./Link";
import { Table, Td, Th, Tr } from "./Table";
import { Headings } from "./Headings";
import { Image } from "./Image";

import "./index.css";
import { remarkRemoveComments } from "./remarkRemoveComments";
import { remarkCustomHeadingIds } from "./remarkCustomHeadingIds";
import { useRemarkSync } from "./useRemarkSync";
import { useToc } from "./useToc";
import { Fragment, useState } from "react";

export type MarkdownProps = {
  children: string;
  showToc?: boolean;
};

export const Markdown = ({ children, showToc = true }: MarkdownProps) => {
  const directives = useDirectives();

  const toc = useToc(children);
  const [isTocOpen, setIsTocOpen] = useState(false);
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
      [
        rehypeHighlight,
        { ignoreMissing: true, plainText: ["mermaid"], detect: true },
      ],
    ],
  });

  return (
    <div className="hyperbook-markdown">
      {showToc && (
        <Fragment>
          <button
            className={isTocOpen ? "toc-toggle open" : "toc-toggle"}
            onClick={() => setIsTocOpen(!isTocOpen)}
            title="Table of Contents"
          >
            <div className="bar1"></div>
            <div className="bar2"></div>
            <div className="bar3"></div>
            <div className="bar4"></div>
          </button>
          <Drawer
            isOpen={isTocOpen}
            onClose={() => setIsTocOpen(false)}
            position="right"
          >
            <div id="toc-sidebar">
              <nav className="toc">
                <ul>
                  {toc.map((h, i) => (
                    <li key={i} className={`level-${h.level}`}>
                      <a href={`#${h.anchor}`}>{h.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </Drawer>
        </Fragment>
      )}
      {reactContent}
    </div>
  );
};
