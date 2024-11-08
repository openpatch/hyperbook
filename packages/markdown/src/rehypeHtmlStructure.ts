// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { ElementContent, Root } from "hast";
import { VFile } from "vfile";

function parseFont(font: string): [string, string] {
  const parts = font.split(":");
  if (parts.length == 2) {
    return [parts[0], parts[1]];
  }

  return [parts[0], "100%"];
}

const makeRootCssElement = ({
  makeUrl,
  config: { colors, font, fonts },
}: HyperbookContext): ElementContent => {
  let rootCss = `
html,
body {
  overflow-x: hidden;
  margin: 0;
}

body {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

body::-webkit-scrollbar {
  display: none;
}
`;
  rootCss += `
:root {
  --color-brand: ${colors?.brand || "#007864"};
  --color-brand-dark: ${colors?.brandDark || colors?.brand || "#b5e3d8"};
  --color-brand-text: ${colors?.brandText || "white"};
}`;

  if (font) {
    rootCss += `
@font-face {
  font-family: hyperbook-heading;
  src: url(${makeUrl(parseFont(font)[0], "public")});
  size-adjust: ${parseFont(font)[1]};
}
@font-face {
  font-family: hyperbook-body;
  src: url(${makeUrl(parseFont(font)[0], "public")});
  size-adjust: ${parseFont(font)[1]};
}
`;
  }
  if (fonts?.body) {
    rootCss += `
@font-face {
  font-family: hyperbook-body;
  src: url(${makeUrl(parseFont(fonts.body)[0], "public")});
  size-adjust: ${parseFont(fonts.body)[1]};
}
`;
  }
  if (fonts?.heading) {
    rootCss += `
@font-face {
  font-family: hyperbook-heading;
  src: url(${makeUrl(parseFont(fonts.heading)[0], "public")});
  size-adjust: ${parseFont(fonts.heading)[1]};
}
`;
  }

  if (fonts?.code) {
    rootCss += `
@font-face {
  font-family: hyperbook-code;
  src: url(${makeUrl(parseFont(fonts.code)[0], "public")});
  size-adjust: ${parseFont(fonts.code)[1]};
}
`;
  }

  rootCss += `
:root {
  --color-background: white;
  --color-text: black;
  --color-text-deactivated: #242428;
  --color-nav: #f5f5f5;
  --color-nav-border: #3c3c3c;
  --color-author-background: #d6d6d6;
  --color-author-color: #3c3c3c;
  --color-spacer: #a4a4a4;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-background: #1e1e1e;
    --color-text: #f5f5f5;
    --color-text-deactivated: #d6d6d6;
    --color-nav: #222222;
    --color-nav-border: #464646;
    --color-author-background: #2c2c2c;
    --color-author-color: #d6d6d6;
    --color-spacer: #3c3c3c;
    --color-brand: var(--color-brand-dark);
  }

  header {
    background: var(--color-nav)!important;
  }

  .branding {
    color: var(--color-brand)!important;
  }

  .toggle .bar1,
  .toggle .bar2,
  .toggle .bar3 {
    background-color: var(--color-brand)!important;
  }
}

body {
  overscroll-behavior-x: none;
  background-color: transparent;
  color: var(--color-text);
  font-family: hyperbook-body;
  font-weight: normal;
  font-size: 16px;
  margin: 0;
  padding: 0;
}

`;

  return {
    type: "element",
    tagName: "style",
    properties: {},
    children: [
      {
        type: "raw",
        value: rootCss,
      },
    ],
  };
};

export default (ctx: HyperbookContext) => () => {
  const {
    makeUrl,
    config,
    navigation: { current: currentPage },
  } = ctx;
  return (tree: Root, file: VFile) => {
    const directives = file.data.directives || {};
    const originalChildren = tree.children as ElementContent[];

    tree.children = [
      {
        type: "doctype",
        data: "html",
      },
      {
        type: "element",
        tagName: "html",
        properties: {
          lang: config.language || "es",
        },
        children: [
          {
            type: "element",
            tagName: "head",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "meta",
                properties: {
                  charset: "UTF-8",
                },
                children: [],
              },
              {
                type: "element",
                tagName: "meta",
                properties: {
                  name: "viewport",
                  content: "width=device-width, initial-scale=1",
                },
                children: [],
              },
              {
                type: "element",
                tagName: "title",
                properties: {},
                children: [
                  {
                    type: "text",
                    value: `${currentPage?.name} - ${config.name}`,
                  },
                ],
              },
              {
                type: "element",
                tagName: "meta",
                properties: {
                  property: "og:title",
                  content: `${currentPage?.name} - ${config.name}`,
                },
                children: [],
              },
              {
                type: "element",
                tagName: "meta",
                properties: {
                  property: "description",
                  content: `${currentPage?.description || config.description}`,
                },
                children: [],
              },
              {
                type: "element",
                tagName: "meta",
                properties: {
                  property: "og:description",
                  content: `${currentPage?.description || config.description}`,
                },
                children: [],
              },
              {
                type: "element",
                tagName: "meta",
                properties: {
                  property: "keywords",
                  content: currentPage?.keywords
                    ? `${currentPage?.keywords.join("")}`
                    : undefined,
                },
                children: [],
              },
              {
                type: "element",
                tagName: "link",
                properties: {
                  rel: "stylesheet",
                  href: makeUrl(["normalize.css"], "assets"),
                },
                children: [],
              },
              makeRootCssElement(ctx),
              {
                type: "element",
                tagName: "link",
                properties: {
                  rel: "stylesheet",
                  href: makeUrl(["shell.css"], "assets"),
                },
                children: [],
              },
              {
                type: "element",
                tagName: "link",
                properties: {
                  rel: "stylesheet",
                  href: makeUrl(["content.css"], "assets"),
                },
                children: [],
              },
              {
                type: "element",
                tagName: "link",
                properties: {
                  rel: "stylesheet",
                  href: makeUrl(["code.css"], "assets"),
                },
                children: [],
              },
              ...(ctx.config.styles || []).map(
                (style) =>
                  ({
                    type: "element",
                    tagName: "link",
                    properties: {
                      rel: "stylesheet",
                      href: style.includes("://")
                        ? style
                        : makeUrl(style, "public"),
                    },
                    children: [],
                  }) as ElementContent,
              ),
              ...(ctx.navigation.current?.styles || []).map(
                (style) =>
                  ({
                    type: "element",
                    tagName: "link",
                    properties: {
                      rel: "stylesheet",
                      href: style.includes("://")
                        ? style
                        : makeUrl(style, "public"),
                    },
                    children: [],
                  }) as ElementContent,
              ),
              {
                type: "element",
                tagName: "script",
                properties: {},
                children: [
                  {
                    type: "raw",
                    value: `
HYPERBOOK_ASSETS = "${makeUrl("/", "assets")}"
`,
                  },
                ],
              },
              {
                type: "element",
                tagName: "script",
                properties: {
                  type: "module",
                  src: makeUrl(["side-drawer.js"], "assets"),
                },
                children: [],
              },
              ...Object.entries(directives).flatMap(([directive, { styles }]) =>
                styles.map(
                  (style) =>
                    ({
                      type: "element",
                      tagName: "link",
                      properties: {
                        rel: "stylesheet",
                        href: style.includes("://")
                          ? style
                          : makeUrl(
                              ["directive-" + directive, style],
                              "assets",
                            ),
                      },
                      children: [],
                    }) as ElementContent,
                ),
              ),
            ],
          },
          {
            type: "element",
            tagName: "body",
            properties: {},
            children: [
              ...originalChildren,
              {
                type: "element",
                tagName: "script",
                properties: {
                  src: makeUrl(["client.js"], "assets"),
                },
                children: [],
              },
              ...Object.entries(directives).flatMap(
                ([directive, { scripts }]) =>
                  scripts.map(
                    (script) =>
                      ({
                        type: "element",
                        tagName: "script",
                        properties: {
                          src: script.includes("://")
                            ? script
                            : makeUrl(
                                ["directive-" + directive, script],
                                "assets",
                              ),
                        },
                        children: [],
                      }) as ElementContent,
                  ),
              ),
              ...(ctx.config.scripts || []).map(
                (script) =>
                  ({
                    type: "element",
                    tagName: "script",
                    properties: {
                      src: script.includes("://")
                        ? script
                        : makeUrl(script, "public"),
                    },
                    children: [],
                  }) as ElementContent,
              ),
              ...(ctx.navigation.current?.scripts || []).map(
                (script) =>
                  ({
                    type: "element",
                    tagName: "script",
                    properties: {
                      src: script.includes("://")
                        ? script
                        : makeUrl(script, "public"),
                    },
                    children: [],
                  }) as ElementContent,
              ),
            ],
          },
        ],
      },
    ];
  };
};
