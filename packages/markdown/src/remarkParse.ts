// @ts-nocheck
import { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { Plugin } from "unified";
import micromarkSubSup from "./micromarkSubSup";
import mdastSubSup from "./mdastSubSup";
import {
  protectMultieventPipes,
  restoreMultieventPipes,
} from "./multieventPipes";
import {
  mdastMultieventMath,
  micromarkMultieventMath,
  multieventMathNodes,
} from "./micromarkMultieventMath";

const remarkParse: Plugin<[], string, Root> = function () {
  const self = this;

  self.parser = function (doc) {
    const extensions = self.data("micromarkExtensions") || [];
    const mdastExtensions = self.data("fromMarkdownExtensions") || [];

    // Marker pipes inside multievent blocks are swapped for a stand-in of the
    // same length, so a marker survives a table row; positions are unchanged.
    const source = protectMultieventPipes(String(doc));

    const tree = fromMarkdown(source, {
      ...self.data("settings"),
      extensions: [micromarkMultieventMath, micromarkSubSup, ...extensions],
      mdastExtensions: [mdastMultieventMath, mdastSubSup, ...mdastExtensions],
    });

    if (source !== String(doc)) restoreMultieventPipes(tree);
    multieventMathNodes(tree);
    return tree;
  };
};

export default remarkParse;
