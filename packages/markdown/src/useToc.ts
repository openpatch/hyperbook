import remarkParse from "remark-parse";
import { unified } from "unified";
import { remarkCustomHeadingIds } from "./remarkCustomHeadingIds";
import { Heading, remarkHeadings } from "./remarkHeadings";

export const useToc = (markdown: string): Heading[] => {
  return unified()
    .use(remarkParse)
    .use(remarkCustomHeadingIds)
    .use(remarkHeadings)
    .processSync(markdown).data.headings;
};
