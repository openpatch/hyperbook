import { Plugin } from "unified";
import { visit } from "unist-util-visit";
import { Root, Text } from "mdast";

import githubEmojiMap from "./github-emojis.json";

export const remarkGithubEmoji: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, "text", (node: Text) => {
      node.value = node.value.replace(/:([+\w-]+):/g, (_, name) => {
        // @ts-ignore
        return githubEmojiMap[name] ?? `:${name}:`;
      });
    });
  };
};
