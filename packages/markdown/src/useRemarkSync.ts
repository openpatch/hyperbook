import * as prod from "react/jsx-runtime";
import { ReactElement, createElement } from "react";
import { PluggableList, unified } from "unified";
import remarkParse from "remark-parse";
import { Options as RemarkRehypeOptions } from "mdast-util-to-hast";
import remarkToRehype from "remark-rehype";
import rehypeReact, { Options as RehypeReactOptions } from "rehype-react";

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface UseRemarkSyncOptions {
  remarkToRehypeOptions?: RemarkRehypeOptions;
  rehypeReactOptions?: PartialBy<
    RehypeReactOptions,
    "Fragment" | "jsx" | "jsxs"
  >;
  remarkPlugins?: PluggableList;
  rehypePlugins?: PluggableList;
}

export const useRemarkSync = (
  source: string,
  {
    remarkToRehypeOptions,
    rehypeReactOptions,
    remarkPlugins = [],
    rehypePlugins = [],
  }: UseRemarkSyncOptions = {}
): ReactElement =>
  unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype, remarkToRehypeOptions)
    .use(rehypePlugins)
    .use(rehypeReact, {
      Fragment: prod.Fragment,
      jsx: prod.jsx,
      jsxs: prod.jsxs,
      ...rehypeReactOptions,
    } as RehypeReactOptions)
    .processSync(source).result;
