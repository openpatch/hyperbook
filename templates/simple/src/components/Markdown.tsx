import ReactMarkdown from "react-markdown";
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

export type MarkdownProps = {
  children: string;
};

type MarkdownLinkProps = {
  href: string;
  title: string;
  children: any;
};

const MarkdownLink = ({ href, title, children }: MarkdownLinkProps) => {
  return (
    <Link href={href}>
      <a title={title}>{children}</a>
    </Link>
  );
};

export const Markdown = (props: MarkdownProps) => {
  return (
    <ReactMarkdown
      {...props}
      remarkPlugins={[
        remarkDirective,
        remarkDirectiveRehype,
        remarkUnwrapImages,
        remarkGfm,
        remarkMath,
        remarkGemoji,
      ]}
      skipHtml={false}
      components={
        {
          ...directives,
          a: MarkdownLink,
          h1: Headings,
          h2: Headings,
          h3: Headings,
          h4: Headings,
          h5: Headings,
          h6: Headings,
          img: Image,
        } as any
      }
      rehypePlugins={[rehypeKatex, rehypeHighlight]}
    />
  );
};
