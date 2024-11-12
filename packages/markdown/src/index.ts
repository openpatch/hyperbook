import { process, remark } from "./process";

declare module "vfile" {
  interface DataMap {
    directives: Record<
      string,
      {
        scripts: string[];
        styles: string[];
      }
    >;
    headings: {
      level: 1 | 2 | 3 | 4 | 5 | 6;
      anchor: string;
      label: string;
    }[];
    searchDocuments: {
      description: string;
      keywords: string[];
      heading: string;
      content: string;
      href: string;
    }[];
  }
}

declare module "mdast" {
  interface HeadingData {
    id?: string;
  }
}

export { process, remark };
