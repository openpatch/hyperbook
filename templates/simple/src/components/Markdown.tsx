import ReactMarkdown, { Components } from "react-markdown";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkGemoji from "remark-gemoji";
import remarkUnwrapImages from "remark-unwrap-images";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import directives from "../components/Directives";
import { Headings } from "./Headings";
import { Image } from "./Image";
import Link from "next/link";
import { MdContentCopy, MdDone } from "react-icons/md";
import { Fragment, useRef, useState } from "react";

export type MarkdownProps = {
  children: string;
};

const MarkdownLink: Components["a"] = ({ href, title, children }) => {
  return (
    <Link href={href}>
      <a title={title}>{children}</a>
    </Link>
  );
};

type CodeProps = {
  inline?: boolean;
  className?: string;
  children: any;
};

const Code = ({ children, className }: CodeProps) => {
  const ref = useRef<HTMLElement>();
  const [copied, setCopied] = useState(false);
  const copyCode = () => {
    if (navigator.clipboard && ref.current) {
      const text = ref.current.innerText;
      navigator.clipboard.writeText(text);

      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Fragment>
      <code ref={ref} className={className}>
        {children}
      </code>
      <button className="copy" onClick={copyCode} aria-label="Copy Code">
        {copied ? <MdDone /> : <MdContentCopy />}
      </button>
    </Fragment>
  );
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
        remarkUnwrapImages,
      ]}
      skipHtml={false}
      components={{
        ...directives,
        a: MarkdownLink,
        code: Code,
        h1: Headings,
        h2: Headings,
        h3: Headings,
        h4: Headings,
        h5: Headings,
        h6: Headings,
        img: Image,
      }}
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
    />
  );
};
