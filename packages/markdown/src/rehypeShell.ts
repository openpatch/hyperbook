// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import {
  HyperbookContext,
  HyperbookPage,
  HyperbookSection,
} from "@hyperbook/types";
import { ElementContent, Root } from "hast";
import { VFile } from "vfile";
import { i18n } from "./i18n";

const makeNavigationPageElement = (
  ctx: HyperbookContext,
  page: HyperbookPage,
): ElementContent => {
  return {
    type: "element",
    tagName: "li",
    properties: {},
    children: [
      {
        type: "element",
        tagName: "a",
        properties: {
          class:
            ctx.navigation.current?.href === page.href ? "page active" : "page",
          href: ctx.makeUrl(page.href || "", "book"),
        },
        children: [
          {
            type: "text",
            value: page.name,
          },
        ],
      },
    ],
  };
};

const makeNavigationSectionElement = (
  ctx: HyperbookContext,
  section: HyperbookSection,
): ElementContent => {
  const { virtual, isEmpty, href, name, pages, sections, expanded } = section;
  const children: ElementContent[] = [];
  let isExpanded =
    ctx.navigation.current?.href?.startsWith(href || "") || expanded;

  if (!virtual) {
    if (isEmpty) {
      children.push({
        type: "element",
        tagName: "div",
        properties: {
          class: [
            "collapsible",
            "name",
            "empty",
            ctx.navigation.current?.href === href ? "active" : "",
            isExpanded ? "expanded" : "",
          ].join(" "),
        },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: {
              class: "label",
            },
            children: [
              {
                type: "text",
                value: name,
              },
            ],
          },
        ],
      });
    } else {
      children.push({
        type: "element",
        tagName: "div",
        properties: {
          class: [
            "collapsible",
            "name",
            ctx.navigation.current?.href === href ? "active" : "",
            isExpanded ? "expanded" : "",
          ].join(" "),
        },
        children: [
          {
            type: "element",
            tagName: "a",
            properties: {
              href: ctx.makeUrl(href || "", "book"),
              class: "label",
            },
            children: [
              {
                type: "text",
                value: name,
              },
            ],
          },
        ],
      });
    }
  }

  const pagesElements: ElementContent[] = pages
    .filter((page) => !page.hide)
    .map((page) => makeNavigationPageElement(ctx, page));

  const linksElements: ElementContent[] = [];
  if (pagesElements.length > 0) {
    linksElements.push({
      type: "element",
      tagName: "ul",
      properties: {
        class: "pages",
      },
      children: pagesElements,
    });
  }

  const sectionElements: ElementContent[] = sections
    .filter((s) => !s.hide)
    .map((s) => makeNavigationSectionElement(ctx, s));
  linksElements.push(...sectionElements);

  children.push({
    type: "element",
    tagName: "div",
    properties: {
      class: virtual ? "links" : "collapsible-content links",
    },
    children: linksElements,
  });
  return {
    type: "element",
    tagName: "div",
    properties: {
      "data-id": `_nav:${href}`,
      class: virtual ? "virtual-section" : "section",
    },
    children,
  };
};

const makeNavigationElements = (ctx: HyperbookContext): ElementContent[] => {
  return [
    {
      type: "element",
      tagName: "nav",
      properties: {},
      children: [
        {
          type: "element",
          tagName: "ul",
          properties: {},
          children: ctx.navigation.pages
            .filter((p) => !p.hide)
            .map((p) => makeNavigationPageElement(ctx, p)),
        },
        ...ctx.navigation.sections
          .filter((s) => !s.hide)
          .map((s) => makeNavigationSectionElement(ctx, s)),
      ],
    },
  ];
};

const makeMetaElements = (ctx: HyperbookContext): ElementContent[] => {
  const elements: ElementContent[] = [];

  if (ctx.navigation.current?.repo) {
    elements.push({
      type: "element",
      tagName: "a",
      properties: {
        class: "edit-github",
        href: ctx.navigation.current.repo,
      },
      children: [
        {
          type: "text",
          value:
            typeof ctx.config.repo == "object" && ctx.config.repo.label
              ? ctx.config.repo.label
              : "✎ GitHub",
        },
      ],
    });
  }

  if (ctx.config.importExport) {
    elements.push({
      type: "element",
      tagName: "a",
      properties: {
        href: "#",
        onclick: "hyperbookExport()",
      },
      children: [
        {
          type: "element",
          tagName: "span",
          properties: {
            class: "export-icon",
            title: i18n.get("shell-export-hyperbook"),
          },
          children: [],
        },
      ],
    });
    elements.push({
      type: "element",
      tagName: "a",
      properties: {
        href: "#",
        onclick: "hyperbookImport()",
      },
      children: [
        {
          type: "element",
          tagName: "span",
          properties: {
            class: "import-icon",
            title: i18n.get("shell-import-hyperbook"),
          },
          children: [],
        },
      ],
    });
  }
  elements.push({
    type: "element",
    tagName: "a",
    properties: {
      href: "#",
      onclick: "hyperbookReset()",
    },
    children: [
      {
        type: "element",
        tagName: "span",
        properties: {
          class: "reset-icon",
          title: i18n.get("shell-reset-hyperbook"),
        },
        children: [],
      },
    ],
  });

  const copyrightChildren: ElementContent[] = [];
  if (ctx.config.license) {
    copyrightChildren.push(linkLicense(ctx));
  } else {
    copyrightChildren.push({
      type: "text",
      value: `© Copyright ${new Date().getFullYear()}`,
    });
  }
  if (ctx.config.author) {
    copyrightChildren.push({
      type: "text",
      value: " by ",
    });
    copyrightChildren.push({
      type: "element",
      tagName: "a",
      properties: {
        href: ctx.config.author.url,
      },
      children: [
        {
          type: "text",
          value: ctx.config.author.name || "",
        },
      ],
    });
  }

  elements.push({
    type: "element",
    tagName: "span",
    properties: {
      class: "copyright",
    },
    children: copyrightChildren,
  });

  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "meta",
      },
      children: elements,
    },
  ];
};

const linkLicense = (ctx: HyperbookContext): ElementContent => {
  const license = ctx.config.license;
  if (!license) return { type: "text", value: "" };
  let href: string | null = null;
  let label: string | null = "";
  switch (license.toLowerCase()) {
    case "cc0": {
      href = "https://creativecommons.org/publicdomain/zero/1.0/";
      label = "CC0";
      break;
    }
    case "cc-by": {
      href = "https://creativecommons.org/licenses/by/4.0";
      label = "CC BY";
      break;
    }
    case "cc-by-sa": {
      href = "https://creativecommons.org/licenses/by-sa/4.0";
      label = "CC BY-SA";
      break;
    }
    case "cc-by-nd": {
      href = "https://creativecommons.org/licenses/by-nd/4.0";
      label = "CC BY-ND";
      break;
    }
    case "cc-by-nc": {
      href = "https://creativecommons.org/licenses/by-nc/4.0";
      label = "CC BY-NC";
      break;
    }
    case "cc-by-nc-sa": {
      href = "https://creativecommons.org/licenses/by-nc-sa/4.0";
      label = "CC BY-NC-SA";
      break;
    }
    case "cc-by-nc-nd": {
      href = "https://creativecommons.org/licenses/by-nc-nd/4.0";
      label = "CC BY-NC-ND";
      break;
    }
  }

  if (href) {
    return {
      type: "element",
      tagName: "a",
      properties: {
        href,
      },
      children: [
        {
          type: "text",
          value: label,
        },
      ],
    };
  }

  return {
    type: "raw",
    value: license,
  };
};

const makeHeaderElements = (ctx: HyperbookContext): ElementContent[] => {
  const { config } = ctx;
  const elements: ElementContent[] = [];

  // mobile nav
  elements.push({
    type: "element",
    tagName: "div",
    properties: {
      class: "mobile-nav",
    },
    children: [
      {
        type: "element",
        tagName: "button",
        properties: {
          "aria-label": "Nav Toggle",
          class: "toggle",
          onclick: "hyperbook.navToggle()",
        },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "bar1",
            },
            children: [],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "bar2",
            },
            children: [],
          },
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "bar3",
            },
            children: [],
          },
        ],
      },
      {
        type: "element",
        tagName: "side-drawer",
        properties: {
          id: "nav-drawer",
        },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: {
              class: "nav-drawer-content",
            },
            children: [
              ...makeNavigationElements(ctx),
              {
                type: "element",
                tagName: "a",
                properties: {
                  class: "author",
                  href: "https://hyperbook.openpatch.org",
                },
                children: [
                  {
                    type: "text",
                    value: "Powered by ",
                  },
                  {
                    type: "element",
                    tagName: "b",
                    properties: {},
                    children: [
                      {
                        type: "text",
                        value: "Hyperbook",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });

  const brandingElements: ElementContent[] = [];
  if (ctx.config.logo) {
    brandingElements.push({
      type: "element",
      tagName: "div",
      properties: {
        class: "logo",
      },
      children: [
        {
          type: "element",
          tagName: "img",
          properties: {
            alt: "logo",
            src: ctx.makeUrl(ctx.config.logo, "public"),
            height: "40",
          },
          children: [],
        },
      ],
    });
  }

  brandingElements.push({
    type: "element",
    tagName: "div",
    properties: {
      class: "name",
    },
    children: [
      {
        type: "text",
        value: ctx.config.name,
      },
    ],
  });

  elements.push({
    type: "element",
    tagName: "a",
    properties: {
      class: "branding",
      href: ctx.makeUrl("/", "book"),
    },
    children: brandingElements,
  });

  if (ctx.config.links) {
    elements.push({
      type: "element",
      tagName: "div",
      properties: {
        id: "custom-links-header",
        class: "custom-links-menu",
      },
      children: [
        {
          type: "element",
          tagName: "ul",
          properties: {
            class: "links-menu",
          },
          children: ctx.config.links.map((link) => {
            let href = "#";
            if ("href" in link) {
              href = link.href;
            }
            let submenu: ElementContent[] = [];
            if ("links" in link) {
              const links: ElementContent[] = link.links.map((link) => {
                let icon: ElementContent[] = [];
                if (link.icon) {
                  icon.push({
                    type: "element",
                    tagName: "div",
                    properties: {
                      class: "icon",
                    },
                    children: [
                      {
                        type: "text",
                        value: link.icon || "",
                      },
                    ],
                  });
                }
                return {
                  type: "element",
                  tagName: "li",
                  properties: {
                    class: "links-item",
                  },
                  children: [
                    {
                      type: "element",
                      tagName: "a",
                      properties: {
                        href: "href" in link ? link.href : "#",
                      },
                      children: [
                        ...icon,
                        {
                          type: "element",
                          tagName: "div",
                          properties: {
                            class: "label",
                          },
                          children: [
                            {
                              type: "text",
                              value: link.label || "",
                            },
                          ],
                        },
                      ],
                    },
                  ],
                };
              });
              submenu.push({
                type: "element",
                tagName: "ul",
                properties: {
                  class: "links-sub-menu",
                },
                children: links,
              });
            }

            const icon: ElementContent[] = [];
            if (link.icon) {
              icon.push({
                type: "element",
                tagName: "div",
                properties: {
                  class: "icon",
                },
                children: [
                  {
                    type: "text",
                    value: link.icon || "",
                  },
                ],
              });
            }
            return {
              type: "element",
              tagName: "li",
              properties: {
                class: ["links-item", submenu.length > 0 ? "sub" : ""].join(
                  " ",
                ),
              },
              children: [
                {
                  type: "element",
                  tagName: "a",
                  properties: {
                    href: href,
                  },
                  children: [
                    ...icon,
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "label",
                      },
                      children: [
                        {
                          type: "text",
                          value: link.label || "",
                        },
                      ],
                    },
                  ],
                },
                ...submenu,
              ],
            };
          }),
        },
      ],
    });
  }

  if (ctx.config.search) {
    elements.push({
      type: "element",
      tagName: "button",
      properties: {
        id: "search-toggle",
        onclick: "hyperbook.searchToggle()",
        title: i18n.get("shell-search"),
      },
      children: [],
    });
    elements.push({
      type: "element",
      tagName: "side-drawer",
      properties: {
        id: "search-drawer",
        right: true,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "search-drawer-content",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                class: "search-input",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "search-icon",
                  },
                  children: [],
                },
                {
                  type: "element",
                  tagName: "input",
                  properties: {
                    id: "search-input",
                    placerholder: "...",
                  },
                  children: [],
                },
                {
                  type: "element",
                  tagName: "button",
                  properties: {
                    class: "search-button",
                    onclick: "hyperbook.search()",
                  },
                  children: [],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                id: "search-results",
              },
              children: [],
            },
          ],
        },
      ],
    });
  }

  elements.push({
    type: "element",
    tagName: "button",
    properties: {
      id: "share-button",
      class: "icon-button",
      title: i18n.get("shell-share"),
      onclick: "hyperbook.shareOpen()",
    },
    children: [
      {
        type: "element",
        tagName: "div",
        properties: {
          class: "share-icon",
        },
        children: [],
      },
    ],
  });

  elements.push({
    type: "element",
    tagName: "dark-mode-toggle",
    properties: {
      id: "dark-mode-toggle",
      appearence: "switch",
      title: i18n.get("shell-toggle-dark-mode"),
      permanent: true,
    },
    children: [],
  });

  return [
    {
      type: "element",
      tagName: "header",
      properties: {
        class: config.colors?.inverted ? "inverted" : undefined,
      },
      children: elements,
    },
  ];
};

const makeJump = (ctx: HyperbookContext): ElementContent[] => {
  const elements: ElementContent[] = [];

  if (ctx.navigation.previous) {
    elements.push({
      type: "element",
      tagName: "a",
      properties: {
        class: "jump previous",
        href: ctx.makeUrl(ctx.navigation.previous.href || "", "book"),
      },
      children: [
        {
          type: "text",
          value: ctx.navigation.previous.name,
        },
      ],
    });
  }

  if (ctx.navigation.next) {
    elements.push({
      type: "element",
      tagName: "a",
      properties: {
        class: "jump next",
        href: ctx.makeUrl(ctx.navigation.next.href || "", "book"),
      },
      children: [
        {
          type: "text",
          value: ctx.navigation.next.name,
        },
      ],
    });
  }

  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "jump-container",
      },
      children: elements,
    },
  ];
};

const makeSidebar = (ctx: HyperbookContext): ElementContent[] => {
  const elements: ElementContent[] = [
    ...makeNavigationElements(ctx),
    {
      type: "element",
      tagName: "a",
      properties: {
        class: "author",
        href: "https://hyperbook.openpatch.org",
      },
      children: [
        {
          type: "text",
          value: "Powered by ",
        },
        {
          type: "element",
          tagName: "b",
          properties: {},
          children: [
            {
              type: "text",
              value: "Hyperbook",
            },
          ],
        },
      ],
    },
  ];

  return [
    {
      type: "element",
      tagName: "div",
      properties: {
        class: "sidebar",
      },
      children: elements,
    },
  ];
};

const makeCustomLinksFooter = (ctx: HyperbookContext) => {
  const elements: ElementContent[] = [];
  if (ctx.config.links) {
    elements.push({
      type: "element",
      tagName: "div",
      properties: {
        id: "custom-links-footer",
      },
      children: ctx.config.links.map((link) => {
        let href = "#";
        if ("href" in link) {
          href = link.href;
        }
        let submenu: ElementContent[] = [];
        if ("links" in link) {
          const links: ElementContent[] = link.links.map((link) => {
            let icon: ElementContent[] = [];
            if (link.icon) {
              icon.push({
                type: "element",
                tagName: "div",
                properties: {
                  class: "icon",
                },
                children: [
                  {
                    type: "text",
                    value: link.icon || "",
                  },
                ],
              });
            }
            return {
              type: "element",
              tagName: "li",
              properties: {
                class: "links-item",
              },
              children: [
                {
                  type: "element",
                  tagName: "a",
                  properties: {
                    href: "href" in link ? link.href : "#",
                  },
                  children: [
                    ...icon,
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "label",
                      },
                      children: [
                        {
                          type: "text",
                          value: link.label || "",
                        },
                      ],
                    },
                  ],
                },
              ],
            };
          });
          submenu.push({
            type: "element",
            tagName: "ul",
            properties: {
              class: "links-sub-menu",
            },
            children: links,
          });
        }

        const icon: ElementContent[] = [];
        if (link.icon) {
          icon.push({
            type: "element",
            tagName: "div",
            properties: {
              class: "icon",
            },
            children: [
              {
                type: "text",
                value: link.icon || "",
              },
            ],
          });
        }
        return {
          type: "element",
          tagName: "ul",
          properties: {
            class: ["links-item", submenu.length > 0 ? "sub" : ""].join(" "),
          },
          children: [
            {
              type: "element",
              tagName: "li",
              properties: {},
              children: [
                {
                  type: "element",
                  tagName: "a",
                  properties: {
                    href: href,
                  },
                  children: [
                    ...icon,
                    {
                      type: "element",
                      tagName: "div",
                      properties: {
                        class: "label",
                      },
                      children: [
                        {
                          type: "text",
                          value: link.label || "",
                        },
                      ],
                    },
                  ],
                },
                ...submenu,
              ],
            },
          ],
        };
      }),
    });
  }

  return elements;
};

export default (ctx: HyperbookContext) => () => {
  return (tree: Root, file: VFile) => {
    const originalChildren = tree.children as ElementContent[];
    const layout = ctx.navigation.current?.layout || "default";
    let mainGridClass = "main-grid";
    if (layout === "wide") {
      mainGridClass = "main-grid layout-wide";
    } else if (layout === "standalone") {
      mainGridClass = "main-grid layout-standalone";
    }

    tree.children = [
      {
        type: "element",
        tagName: "div",
        properties: {
          class: mainGridClass,
        },
        children: [
          ...makeHeaderElements(ctx),
          ...makeSidebar(ctx),
          {
            type: "element",
            tagName: "main",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "article",
                properties: {},
                children: originalChildren,
              },
              ...makeJump(ctx),
              ...makeMetaElements(ctx),
              ...makeCustomLinksFooter(ctx),
            ],
          },
        ],
      },
    ];
  };
};
