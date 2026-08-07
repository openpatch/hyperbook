// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";

import { isDirective } from "./remarkHelper";

/**
 * Keys of an element's configuration that say something about the element
 * itself rather than about one of its parameters.
 */
const notAParameter = new Set(["cdn", "version"]);

/**
 * Fills in the parameters of an element from the configuration of the
 * hyperbook, so a default can be set once instead of on every use.
 *
 * ```json
 * { "elements": { "sqlide": { "height": "500px" } } }
 * ```
 *
 * gives every SQL IDE that height. An element that sets the parameter itself
 * keeps what it set, so this only fills in what is missing.
 *
 * It runs before the elements themselves, so each of them reads its parameters
 * the way it always did and none of them has to know about the configuration.
 */
export default (ctx: HyperbookContext) => () => {
  return (tree: Root) => {
    const elements = ctx.config.elements;
    if (!elements) {
      return;
    }

    visit(tree, (node) => {
      if (!isDirective(node)) {
        return;
      }

      const config = elements[node.name];
      if (!config || config === true) {
        return;
      }

      const attributes = node.attributes || (node.attributes = {});
      for (const [parameter, value] of Object.entries(config)) {
        if (notAParameter.has(parameter)) {
          continue;
        }
        // An element reads its parameters as text, the way they are written on
        // it, so anything with a shape of its own is left to the element to
        // read from the configuration itself.
        if (
          value === undefined ||
          value === null ||
          typeof value === "object"
        ) {
          continue;
        }
        if (attributes[parameter] === undefined) {
          attributes[parameter] = String(value);
        }
      }
    });
  };
};
