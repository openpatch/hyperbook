import { Fragment, ReactElement, createElement } from "react";
import unified, { PluggableList } from "unified";
import remarkParse from "remark-parse";
import { Options as RemarkRehypeOptions } from "mdast-util-to-hast";
import remarkToRehype from "remark-rehype";
import rehypeReact, { Options as RehypeReactOptions } from "rehype-react";

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export interface UseRemarkSyncOptions {
  remarkToRehypeOptions?: RemarkRehypeOptions;
  rehypeReactOptions?: PartialBy<RehypeReactOptions, "createElement">;
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
  unified
    .unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype, remarkToRehypeOptions)
    .use(rehypePlugins)
    .use(rehypeReact, {
      createElement,
      Fragment,
      ...rehypeReactOptions,
    } as RehypeReactOptions)
    .processSync(source).result as ReactElement;
