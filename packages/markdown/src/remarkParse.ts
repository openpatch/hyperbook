// @ts-nocheck
import { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { Plugin } from "unified";
import micromarkSubSup from "./micromarkSubSup";
import mdastSubSup from "./mdastSubSup";

const remarkParse: Plugin<[], string, Root> = function () {
  const self = this;

  self.parser = function (doc) {
    const extensions = self.data("micromarkExtensions") || [];
    const mdastExtensions = self.data("fromMarkdownExtensions") || [];

    return fromMarkdown(doc, {
      ...self.data("settings"),
      extensions: [micromarkSubSup, ...extensions],
      mdastExtensions: [mdastSubSup, ...mdastExtensions],
    });
  };
};

export default remarkParse;
