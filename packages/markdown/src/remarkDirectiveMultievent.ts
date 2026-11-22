// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { resolveDirectiveId } from "./directiveId";
import { recordStoredElement } from "./storedElements";
import { elementAssetUrl } from "./elementAssets";

/** Whether a multievent holds a math field, `{m{…}}`. */
const hasMathField = (node: unknown): boolean => {
  let found = false;
  visit(node as Root, (child: any) => {
    if (
      child.type === "multieventMath" ||
      (typeof child.value === "string" && child.value.includes("{m{"))
    ) {
      found = true;
      return false;
    }
  });
  return found;
};

export default (ctx: HyperbookContext) => () => {
  const name = "multievent";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectContainerDirective(node, file, name);
        registerDirective(file, name, ["multievent.js"], ["style.css"], []);

        // The key the reader's state is saved under (multievent.js storeKey).
        const id = (node.attributes?.id as string | undefined) || resolveDirectiveId(file, node);
        recordStoredElement(file, name, id, node);

        // Math fields need MathLive and the Compute Engine, a downloadable
        // runtime of their own: only a page with math fields asks for it,
        // and the multievent says where it loads from (local, CDN or host).
        const mathfield = hasMathField(node)
          ? {
              "data-mathfield": JSON.stringify({
                mathlive: elementAssetUrl(ctx, "mathfield", "mathlive.min.mjs"),
                engine: elementAssetUrl(
                  ctx,
                  "mathfield",
                  "compute-engine/compute-engine.js",
                ),
              }),
            }
          : {};
        if (mathfield["data-mathfield"]) registerDirective(file, "mathfield");

        data.hName = "div";
        data.hProperties = {
          class: "directive-multievent multievent",
          "data-id": id,
          ...mathfield,
          style: "visibility: hidden; opacity: 0;",
        };
      }
    });
  };
};
