import { HyperbookContext } from "@hyperbook/types";
import { Element, Root, RootContent } from "hast";
import { toHtml } from "hast-util-to-html";
import { VFile } from "vfile";
import { DEFAULT_ITERATIONS, encryptHtml } from "./protect";

/**
 * Directives set their classes through `hProperties`, which passes keys
 * through verbatim — so these arrive as a `class` string rather than the
 * hast-normalized `className` array. Both are accepted, because plugins
 * further up the pipeline may have normalized the tree.
 */
const hasClass = (node: RootContent, className: string): node is Element => {
  if (node.type !== "element") return false;
  const value = node.properties?.class ?? node.properties?.className;
  if (typeof value === "string") return value.split(/\s+/).includes(className);
  if (Array.isArray(value)) return value.includes(className);
  return false;
};

/**
 * Collects protect containers innermost-first.
 *
 * Order matters for nested blocks: the inner block must already be ciphertext
 * when the outer one is serialized, otherwise the outer password would reveal
 * the inner content in one step. Unlocking then peels one layer at a time —
 * the outer plaintext contains the inner block's placeholder, and the client's
 * MutationObserver initializes it on injection.
 */
const collectDepthFirst = (node: Root | Element, out: Element[]): void => {
  for (const child of node.children) {
    if (child.type === "element") {
      collectDepthFirst(child, out);
    }
  }
  if (node.type === "element" && hasClass(node as RootContent, "directive-protect")) {
    out.push(node);
  }
};

export default (ctx: HyperbookContext) => () => {
  const mode = ctx.config.protect?.mode || "encrypt";
  const iterations = ctx.config.protect?.iterations || DEFAULT_ITERATIONS;

  return (tree: Root, file: VFile) => {
    const secrets = file.data.protect;
    if (!secrets) return;

    const containers: Element[] = [];
    collectDepthFirst(tree, containers);

    for (const container of containers) {
      const instanceId = container.properties?.["data-instance"] as
        | string
        | undefined;
      if (!instanceId) continue;

      const secret = secrets[instanceId];
      if (!secret) continue;

      const hiddenIndex = container.children.findIndex((c) =>
        hasClass(c, "hidden"),
      );
      if (hiddenIndex === -1) continue;
      const hidden = container.children[hiddenIndex] as Element;

      if (mode === "obfuscate") {
        // Legacy behaviour, for books served from file:// where crypto.subtle
        // does not exist. This provides no protection.
        container.properties = {
          ...container.properties,
          "data-toast": Buffer.from(secret.password, "utf8").toString("base64"),
        };
        delete container.properties["data-instance"];
        delete secrets[instanceId];
        continue;
      }

      const payload = encryptHtml(
        toHtml(hidden.children as RootContent[]),
        secret.password,
        iterations,
      );

      // A <script> body is raw text in hast, so an unescaped "</script>" would
      // break out of the tag. Every payload field is base64 or a number.
      container.children[hiddenIndex] = {
        type: "element",
        tagName: "script",
        properties: {
          type: "application/json",
          className: ["protect-payload"],
        },
        children: [{ type: "text", value: JSON.stringify(payload) }],
      };

      delete container.properties!["data-instance"];
      delete secrets[instanceId];
    }
  };
};
