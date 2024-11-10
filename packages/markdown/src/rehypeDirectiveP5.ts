// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import fs from "fs";
import path from "path";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectContainerDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";

interface CodeBundle {
  js?: string;
  scripts?: string[];
}

export default (ctx: HyperbookContext) => () => {
  const name = "p5";
  const cdnLibraryUrl = ctx.makeUrl(
    path.posix.join("directive-p5", "p5.min.js"),
    "assets",
  );

  const wrapSketch = (sketchCode?: string) => {
    if (sketchCode !== "" && !sketchCode?.includes("setup")) {
      return `
      function setup() {
        createCanvas(100, 100);
        background(200);
        ${sketchCode}
      }`;
    }
    return sketchCode;
  };

  // see https://github.com/processing/p5.js-website/blob/main/src/components/CodeEmbed/frame.tsx
  const wrapInMarkup = (code: CodeBundle) =>
    `<!DOCTYPE html>
<meta charset="utf8" />
<base href="${ctx.makeUrl("", "public")}" />
<style type='text/css'>
html, body {
  margin: 0;
  padding: 0;
}
canvas {
  display: block;
}
</style>
${(code.scripts ? [cdnLibraryUrl, ...code.scripts] : []).map((src) => `<script type="text/javascript" src="${src}"></script>`).join("\n")}
<body></body>
<script id="code" type="text/javascript">${wrapSketch(code.js) || ""}</script>
${
  (code.scripts?.length ?? 0) > 0
    ? ""
    : `
<script type="text/javascript">
  // Listen for p5.min.js text content and include in iframe's head as script
  window.addEventListener("message", event => {
    // Include check to prevent p5.min.js from being loaded twice
    const scriptExists = !!document.getElementById("p5ScriptTagInIframe");
    if (!scriptExists && event.data?.sender === '${cdnLibraryUrl}') {
      const p5ScriptElement = document.createElement('script');
      p5ScriptElement.id = "p5ScriptTagInIframe";
      p5ScriptElement.type = 'text/javascript';
      p5ScriptElement.textContent = event.data.message;
      document.head.appendChild(p5ScriptElement);
    }
  })
</script>
`
}
`.replace(/\u00A0/g, " ");

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (node.type === "element" && node.tagName === "p5") {
        const { src = "" } = node.properties || {};

        expectContainerDirective(node, file, name);
        registerDirective(file, name, [], ["style.css"]);

        const srcFile = fs.readFileSync(
          path.join(ctx.root, "public", String(src)),
          "utf8",
        );

        const srcdoc = wrapInMarkup({
          js: srcFile,
          scripts: [
            ctx.makeUrl(
              path.posix.join("directive-p5", "p5.sound.min.js"),
              "assets",
            ),
          ],
        });
        node.tagName = "div";
        node.properties = {
          class: "directive-p5",
        };
        node.children = [
          {
            type: "element",
            tagName: "iframe",
            properties: {
              srcdoc: srcdoc,
              loading: "eager",
              sandbox:
                "allow-scripts allow-popups allow-modals allow-forms allow-same-origin",
              "aria-label": "Code Preview",
              title: "Code Preview",
            },
            children: [],
          },
        ];
      }
    });
  };
};
