import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { remarkCustomHeadingIds } from "./remarkCustomHeadingIds";
import { Heading, remarkHeadings } from "./remarkHeadings";

export const useToc = (markdown: string): Heading[] => {
  return unified()
    .use(remarkCustomHeadingIds)
    .use(remarkParse)
    .use(remarkStringify)
    .use(remarkHeadings)
    .processSync(markdown).data.headings;
};
