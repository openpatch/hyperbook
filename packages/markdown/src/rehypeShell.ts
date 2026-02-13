// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import {
  BreadcrumbConfig,
  HyperbookContext,
  HyperbookPage,
  HyperbookSection,
} from "@hyperbook/types";
import { ElementContent, Root } from "hast";
import { VFile } from "vfile";
import { i18n } from "./i18n";
import githubEmojiMap from "./github-emojis.json";

// Helper to resolve emoji shortcuts like :house: to actual emoji
const resolveEmoji = (text: string): string => {
  return text.replace(/:([+\w-]+):/g, (_, name) => {
    // @ts-ignore
    return githubEmojiMap[name] ?? `:${name}:`;
  });
};

type BreadcrumbItem = {
  name: string;
  href: string | null;
  isEmpty: boolean;
  hide?: boolean;
};

// Build breadcrumb path from root to current page
const buildBreadcrumbPath = (
  ctx: HyperbookContext,
): BreadcrumbItem[] => {
  const currentHref = ctx.navigation.current?.href;
  if (!currentHref) return [];

  const path: BreadcrumbItem[] = [];

  // Helper to search for the current page in sections recursively
  const findPath = (
    sections: HyperbookSection[],
    pages: HyperbookPage[],
    currentPath: BreadcrumbItem[],
  ): BreadcrumbItem[] | null => {
    // Check pages at this level
    for (const page of pages) {
      if (page.href === currentHref) {
        return [...currentPath, { 
          name: page.name, 
          href: page.href || null, 
          isEmpty: page.isEmpty || false,
          hide: page.hide,
        }];
      }
    }

    // Check sections
    for (const section of sections) {
      const sectionItem: BreadcrumbItem = {
        name: section.name,
        href: section.href || null,
        isEmpty: section.isEmpty || false,
        hide: section.hide,
      };

      // Check if current page is the section index itself
      if (section.href === currentHref) {
        return [...currentPath, sectionItem];
      }

      // Search in nested sections and pages
      const result = findPath(
        section.sections,
        section.pages,
        [...currentPath, sectionItem],
      );
      if (result) return result;
    }

    return null;
  };

  const result = findPath(
    ctx.navigation.sections,
    ctx.navigation.pages,
    [],
  );

  return result || [];
};

const makeBreadcrumbElements = (ctx: HyperbookContext): ElementContent[] => {
  // Don't show breadcrumb on root index page
  const currentHref = ctx.navigation.current?.href;
  if (!currentHref || currentHref === "/") return [];

  // Determine if breadcrumb is enabled and get config
  const pageBreadcrumb = ctx.navigation.current?.breadcrumb;
  const globalBreadcrumb = ctx.config.breadcrumb;

  // Page-level setting overrides global, false disables
  let breadcrumbEnabled: boolean | BreadcrumbConfig | undefined;
  if (pageBreadcrumb !== undefined) {
    breadcrumbEnabled = pageBreadcrumb;
  } else {
    breadcrumbEnabled = globalBreadcrumb;
  }

  if (!breadcrumbEnabled) return [];

  // Get config values
  let home = "🏠";
  let separator = ">";
  
  if (typeof breadcrumbEnabled === "object") {
    if (breadcrumbEnabled.home !== undefined) {
      home = resolveEmoji(breadcrumbEnabled.home);
    }
    if (breadcrumbEnabled.separator !== undefined) {
      separator = resolveEmoji(breadcrumbEnabled.separator);
    }
  }

  const breadcrumbPath = buildBreadcrumbPath(ctx);
  if (breadcrumbPath.length === 0) return [];

  const elements: ElementContent[] = [];

  // Add home link
  elements.push({
    type: "element",
    tagName: "a",
    properties: {
      class: "breadcrumb-home",
      href: ctx.makeUrl("/", "book"),
      "aria-label": i18n.get("breadcrumb-home"),
    },
    children: [
      {
        type: "text",
        value: home,
      },
    ],
  });

  // Add breadcrumb items
  for (let i = 0; i < breadcrumbPath.length; i++) {
    const item = breadcrumbPath[i];
    const isLast = i === breadcrumbPath.length - 1;

    // Add separator
    elements.push({
      type: "element",
      tagName: "span",
      properties: {
        class: "breadcrumb-separator",
        "aria-hidden": "true",
      },
      children: [
        {
          type: "text",
          value: separator,
        },
      ],
    });

    // Add breadcrumb item - only link if not empty and not hidden
    if (item.isEmpty || item.hide || !item.href) {
      // Render as span (not clickable)
      elements.push({
        type: "element",
        tagName: "span",
        properties: {
          class: isLast ? "breadcrumb-item breadcrumb-current" : "breadcrumb-item breadcrumb-empty",
          "aria-current": isLast ? "page" : undefined,
        },
        children: [
          {
            type: "text",
            value: item.name,
          },
        ],
      });
    } else {
      // Render as link
      elements.push({
        type: "element",
        tagName: "a",
        properties: {
          class: isLast ? "breadcrumb-item breadcrumb-current" : "breadcrumb-item",
          href: ctx.makeUrl(item.href, "book"),
          "aria-current": isLast ? "page" : undefined,
        },
        children: [
          {
            type: "text",
            value: item.name,
          },
        ],
      });
    }
  }

  return [
    {
      type: "element",
      tagName: "nav",
      properties: {
        class: "breadcrumb",
        "aria-label": i18n.get("breadcrumb-navigation"),
      },
      children: elements,
    },
  ];
};

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

const makeNavigationSectionAsPageElement = (
  ctx: HyperbookContext,
  section: HyperbookSection,
): ElementContent => {
  const { href, name } = section;
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
            ctx.navigation.current?.href === href ? "page active" : "page",
          href: ctx.makeUrl(href || "", "book"),
        },
        children: [
          {
            type: "text",
            value: name,
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
  const { virtual, isEmpty, href, name, pages, sections, expanded, navigation } = section;
  
  // Determine effective navigation mode (new field takes precedence over legacy fields)
  const isVirtual = navigation === "virtual" || (navigation === undefined && virtual);
  const isExpanded = navigation === "expanded" || (navigation === undefined && expanded) || 
    ctx.navigation.current?.href?.startsWith(href || "");

  const pagesElements: ElementContent[] = pages
    .filter((page) => !page.hide && page.navigation !== "hidden" && page.href !== href)
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

  // Handle page-mode sections - they should be rendered as pages in the pages list
  const pageModeChildSections = sections
    .filter((s) => !s.hide && s.navigation !== "hidden" && s.navigation === "page" && !s.isEmpty);
  
  // Merge pages and page-mode sections, sort by index
  if (pageModeChildSections.length > 0) {
    // We need to combine the existing pages with page-mode sections
    const combinedItems: { index?: number; name: string; element: ElementContent }[] = [
      ...pages
        .filter((page) => !page.hide && page.navigation !== "hidden" && page.href !== href)
        .map((page) => ({ 
          index: page.index, 
          name: page.name, 
          element: makeNavigationPageElement(ctx, page) 
        })),
      ...pageModeChildSections.map((s) => ({ 
        index: s.index, 
        name: s.name, 
        element: makeNavigationSectionAsPageElement(ctx, s) 
      })),
    ].sort((a, b) => {
      const aIndex = a.index !== undefined ? a.index : 9999;
      const bIndex = b.index !== undefined ? b.index : 9999;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.name > b.name ? 1 : -1;
    });

    // Replace pagesElements with combined sorted elements
    linksElements.length = 0; // Clear existing
    if (combinedItems.length > 0) {
      linksElements.push({
        type: "element",
        tagName: "ul",
        properties: {
          class: "pages",
        },
        children: combinedItems.map((item) => item.element),
      });
    }
  }

  // Regular sections (not page-mode)
  const sectionElements: ElementContent[] = sections
    .filter((s) => !s.hide && s.navigation !== "hidden" && s.navigation !== "page")
    .map((s) => makeNavigationSectionElement(ctx, s));
  linksElements.push(...sectionElements);

  // For virtual sections, just render the links without a container
  if (isVirtual) {
    return {
      type: "element",
      tagName: "div",
      properties: {
        class: "virtual-section",
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "links",
          },
          children: linksElements,
        },
      ],
    };
  }

  // Use native <details> element for collapsible sections
  const summaryChildren: ElementContent[] = [];
  
  if (isEmpty) {
    summaryChildren.push({
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
    });
  } else {
    summaryChildren.push({
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
    });
  }

  return {
    type: "element",
    tagName: "details",
    properties: {
      "data-id": `_nav:${href}`,
      class: [
        "section",
        ctx.navigation.current?.href === href ? "active" : "",
        isEmpty ? "empty" : "",
      ].join(" "),
      open: isExpanded,
    },
    children: [
      {
        type: "element",
        tagName: "summary",
        properties: {
          class: "name",
        },
        children: summaryChildren,
      },
      {
        type: "element",
        tagName: "div",
        properties: {
          class: "links",
        },
        children: linksElements,
      },
    ],
  };
};

// Helper type for navigation items that can be sorted together
type NavigationItem = 
  | { type: "page"; item: HyperbookPage }
  | { type: "section"; item: HyperbookSection };

const makeNavigationElements = (ctx: HyperbookContext): ElementContent[] => {
  // Collect all navigation items (pages and sections in "page" mode go to pages list)
  const pageItems: NavigationItem[] = ctx.navigation.pages
    .filter((p) => !p.hide && p.navigation !== "hidden")
    .map((p) => ({ type: "page" as const, item: p }));
  
  const pageModeSecions: NavigationItem[] = ctx.navigation.sections
    .filter((s) => !s.hide && s.navigation !== "hidden" && s.navigation === "page" && !s.isEmpty)
    .map((s) => ({ type: "section" as const, item: s }));
  
  const regularSections = ctx.navigation.sections
    .filter((s) => !s.hide && s.navigation !== "hidden" && s.navigation !== "page");

  // Merge pages and page-mode sections, then sort by index
  const combinedItems = [...pageItems, ...pageModeSecions].sort((a, b) => {
    const aIndex = a.item.index !== undefined ? a.item.index : 9999;
    const bIndex = b.item.index !== undefined ? b.item.index : 9999;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.item.name > b.item.name ? 1 : -1;
  });

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
          children: combinedItems.map((navItem) => {
            if (navItem.type === "page") {
              return makeNavigationPageElement(ctx, navItem.item);
            } else {
              // Render section in page mode as a page element
              return makeNavigationSectionAsPageElement(ctx, navItem.item);
            }
          }),
        },
        ...regularSections.map((s) => makeNavigationSectionElement(ctx, s)),
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
        onclick: "hyperbook.store.export()",
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
        onclick: "hyperbook.store.import()",
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
      onclick: "hyperbook.store.reset()",
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
          onclick: "hyperbook.ui.navToggle()",
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
        onclick: "hyperbook.ui.searchToggle()",
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
                    onclick: "hyperbook.ui.search()",
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
      onclick: "hyperbook.share.open()",
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

  if (config.cloud) {
    elements.push({
      type: "element",
      tagName: "button",
      properties: {
        id: "user-toggle",
        class: "icon-button",
        title: "User",
        onclick: "hyperbook.cloud.userToggle()",
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "user-icon",
          },
          children: [],
        },
      ],
    });

    // Add user drawer (popup)
    elements.push({
      type: "element",
      tagName: "side-drawer",
      properties: {
        id: "user-drawer",
        right: true,
      },
      children: [
        {
          type: "element",
          tagName: "div",
          properties: {
            class: "user-drawer-content",
          },
          children: [
            {
              type: "element",
              tagName: "div",
              properties: {
                id: "user-login-form",
                class: "user-form",
              },
              children: [
                {
                  type: "element",
                  tagName: "h3",
                  properties: {},
                  children: [
                    {
                      type: "text",
                      value: i18n.get("user-login-title"),
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "input",
                  properties: {
                    type: "text",
                    id: "user-username",
                    placeholder: i18n.get("user-username"),
                  },
                  children: [],
                },
                {
                  type: "element",
                  tagName: "input",
                  properties: {
                    type: "password",
                    id: "user-password",
                    placeholder: i18n.get("user-password"),
                  },
                  children: [],
                },
                {
                  type: "element",
                  tagName: "button",
                  properties: {
                    onclick: "hyperbook.cloud.login()",
                  },
                  children: [
                    {
                      type: "text",
                      value: i18n.get("user-login"),
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    id: "user-login-error",
                    class: "user-error",
                  },
                  children: [],
                },
              ],
            },
            {
              type: "element",
              tagName: "div",
              properties: {
                id: "user-info",
                class: "user-info hidden",
              },
              children: [
                {
                  type: "element",
                  tagName: "h3",
                  properties: {},
                  children: [
                    {
                      type: "text",
                      value: i18n.get("user-info-title"),
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "p",
                  properties: {},
                  children: [
                    {
                      type: "element",
                      tagName: "strong",
                      properties: {},
                      children: [
                        {
                          type: "text",
                          value: i18n.get("user-username") + ": ",
                        },
                      ],
                    },
                    {
                      type: "element",
                      tagName: "span",
                      properties: {
                        id: "user-display-name",
                      },
                      children: [],
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "p",
                  properties: {},
                  children: [
                    {
                      type: "element",
                      tagName: "strong",
                      properties: {},
                      children: [
                        {
                          type: "text",
                          value: i18n.get("user-status") + ": ",
                        },
                      ],
                    },
                    {
                      type: "element",
                      tagName: "span",
                      properties: {
                        id: "user-save-status",
                      },
                      children: [
                        {
                          type: "text",
                          value: i18n.get("user-saved"),
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "button",
                  properties: {
                    onclick: "hyperbook.cloud.save()",
                  },
                  children: [
                    {
                      type: "text",
                      value: i18n.get("user-save"),
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "button",
                  properties: {
                    onclick: "hyperbook.cloud.logout()",
                    class: "logout-btn",
                  },
                  children: [
                    {
                      type: "text",
                      value: i18n.get("user-logout"),
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
  }

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
              ...makeBreadcrumbElements(ctx),
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
