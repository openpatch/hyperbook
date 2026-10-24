// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext, elementCdn } from "@hyperbook/types";
import { elementAssetUrl } from "./elementAssets";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import {
  collectWorkspace,
  compareAttributes,
  fileActionAttributes,
  cssHeight,
  encodeWorkspace,
  htmlEntities,
  ideBottomButtons,
  idePanelHeader,
  idePanelTitle,
  ideSplitter,
  requestIdeAssets,
} from "./ideWorkspace";
import { resolveDirectiveId } from "./directiveId";
import { ElementContent } from "hast";
import { i18n } from "./i18n";

/** A button of the switch between output and canvas. */
const viewButton = (className: string, labelKey: string): ElementContent => ({
  type: "element",
  tagName: "button",
  properties: { class: `ide-view ${className}`, type: "button" },
  children: [{ type: "text", value: i18n.get(labelKey) }],
});

function parsePackagesAttribute(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((pkg) => pkg.trim())
        .filter((pkg) => pkg.length > 0),
    ),
  );
}

export default (ctx: HyperbookContext) => () => {
  const name = "pyide";
  const cdn = elementCdn(ctx.config, name);
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const {
          id = resolveDirectiveId(file, node),
          packages,
          height,
        } = node.attributes || {};
        const hasCanvas = "canvas" in (node.attributes || {});
        // pytamaro needs pillow 11.3.0, which the bundled Pyodide does not
        // have, so micropip cannot install it. Off until it can.
        const requested = parsePackagesAttribute(packages);
        const packageList = requested.filter(
          (pkg) => pkg.toLowerCase() !== "pytamaro",
        );
        if (packageList.length < requested.length) {
          file.message(
            'The pyide directive does not support packages="pytamaro" for now: it needs a version of pillow that Pyodide does not provide.',
            node as never,
          );
        }

        expectDirective(node, file, name, ["leaf", "container"]);
        registerDirective(
          file,
          name,
          ["python-friendly-error-messages.js", "client.js"],
          ["style.css"],
          [],
        );
        requestIdeAssets(file);

        if (node.attributes?.src) {
          file.message(
            'pyide no longer reads src="…"; load the file with ::file{path="main.py" src="…"} inside the directive. Run `hyperbook migrate` to convert the page.',
            node,
          );
        }

        const workspace = collectWorkspace(node, file, ctx, {
          name,
          langs: ["python"],
          defaultMain: "main.py",
        });
        const mainFile = workspace.files.find((f) => f.path === workspace.main);
        const hasTests = workspace.files.some((f) => f.role === "test");
        if ("compare" in (node.attributes || {}) && !hasCanvas) {
          file.message(
            "pyide compares drawings, so compare needs the canvas attribute too.",
            node,
          );
        }
        const compare = hasCanvas
          ? compareAttributes(node, file, workspace, name)
          : {};

        data.hName = "div";
        data.hProperties = {
          class: "directive-pyide ide",
          ...(cdn
            ? { "data-runtime-url": elementAssetUrl(ctx, name, "pyodide/") }
            : {}),
          id: id ?? undefined,
          "data-workspace": encodeWorkspace(workspace),
          ...fileActionAttributes(node, file, { name, accept: ".py" }),
          ...compare,
          ...(hasCanvas ? { "data-canvas": "true" } : {}),
          ...(packageList.length > 0
            ? { "data-packages": packageList.join(",") }
            : {}),
          ...(height ? { style: `--ide-height: ${cssHeight(height)}` } : {}),
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "container",
            },
            children: [
              // With a canvas, output and canvas are tabs of one panel.
              hasCanvas
                ? idePanelHeader("canvas-tabs", [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "ide-view-switch",
                        role: "group",
                      },
                      children: [
                        viewButton("canvas-btn active", "pyide-canvas"),
                        viewButton("output-btn", "pyide-output"),
                      ],
                    },
                  ])
                : idePanelHeader("", [idePanelTitle("pyide-output")]),
              ...(hasCanvas
                ? [
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "canvas-wrapper",
                      },
                      children: [
                        {
                          type: "element",
                          tagName: "canvas",
                          properties: {
                            class: "canvas",
                          },
                          children: [],
                        } as ElementContent,
                      ],
                    } as ElementContent,
                  ]
                : []),
              {
                type: "element",
                tagName: "pre",
                properties: {
                  // With a canvas, the canvas tab is open first.
                  class: hasCanvas ? "output hidden" : "output",
                },
                children: [],
              },
              // Shown only while the running script waits on input(). Reading
              // input here keeps the main thread free, so drawings stay live.
              {
                type: "element",
                tagName: "form",
                properties: {
                  class: "stdin hidden",
                },
                children: [
                  // The prompt also goes to the output panel, but that panel is
                  // hidden while the canvas tab is open — so repeat it here.
                  {
                    type: "element",
                    tagName: "span",
                    properties: {
                      class: "stdin-prompt",
                    },
                    children: [],
                  },
                  {
                    type: "element",
                    tagName: "input",
                    properties: {
                      class: "stdin-field",
                      type: "text",
                      autocomplete: "off",
                      spellcheck: "false",
                      "aria-label": i18n.get("pyide-input"),
                    },
                    children: [],
                  },
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "stdin-submit",
                      type: "submit",
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("pyide-input-submit"),
                      },
                    ],
                  },
                ],
              },
            ],
          },
          ideSplitter(),
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "editor-container",
            },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "buttons",
                },
                children: [
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "run",
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("pyide-run"),
                      },
                    ],
                  },
                  ...(hasTests
                    ? [
                        {
                          type: "element",
                          tagName: "button",
                          properties: {
                            class: "test",
                          },
                          children: [
                            {
                              type: "text",
                              value: i18n.get("pyide-test"),
                            },
                          ],
                        } as ElementContent,
                      ]
                    : []),
                  {
                    type: "element",
                    tagName: "button",
                    properties: {
                      class: "stop",
                      disabled: true,
                    },
                    children: [
                      {
                        type: "text",
                        value: i18n.get("pyide-stop"),
                      },
                    ],
                  },
                ],
              },
              {
                type: "element",
                tagName: "div",
                properties: {
                  class: "editor",
                  "data-lang": "python",
                },
                children: [
                  {
                    type: "raw",
                    value: htmlEntities(mainFile?.content ?? ""),
                  },
                ],
              },
              ideBottomButtons(),
            ],
          },
        ];
      }
    });
  };
};
