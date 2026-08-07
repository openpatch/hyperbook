import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import rehypeFormat from "rehype-format";
import { ctx } from "./mock";
import rehypeTableOfContents from "../src/rehypeTableOfContents";
import rehypeShell from "../src/rehypeShell";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  return unified()
    .use(remarkParse)
    .use(rehypeShell(ctx))
    .use(rehypeTableOfContents(ctx))
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md);
};

describe("rehypeShell", () => {
  const virtualCtx: HyperbookContext = {
    ...ctx,
    navigation: {
      ...ctx.navigation,
      sections: [
        {
          virtual: true,
          name: "__I_AM_NOT_HERE",
          sections: [],
          pages: [],
        },
        {
          virtual: false,
          name: "__I_AM_HERE",
          sections: [],
          pages: [],
        },
      ],
    },
  };
  describe("section navigation affordance", () => {
    // The stylesheet tells a section that links to a page apart from one that
    // only expands, using the `empty` class on the <details> and whether the
    // title is an <a> or a <span>. Both are asserted here so a markup change
    // cannot silently make the two kinds look identical again.
    const sectionCtx: HyperbookContext = {
      ...ctx,
      navigation: {
        ...ctx.navigation,
        sections: [
          {
            name: "__LINKS_TO_A_PAGE",
            href: "/linked",
            isEmpty: false,
            sections: [],
            pages: [],
          },
          {
            name: "__ONLY_EXPANDS",
            href: "/expander",
            isEmpty: true,
            sections: [],
            pages: [],
          },
        ],
      },
    };

    const html = () => String(toHtml("", sectionCtx).value);

    it("marks a section without its own page as empty", () => {
      expect(html()).toMatch(
        /<details[^>]*data-id="_nav:\/expander"[^>]*class="[^"]*\bempty\b/,
      );
    });

    it("does not mark a section that has its own page as empty", () => {
      const match = html().match(
        /<details[^>]*data-id="_nav:\/linked"[^>]*class="([^"]*)"/,
      );
      expect(match).not.toBeNull();
      expect(match![1]).not.toContain("empty");
    });

    it("renders the title of a linking section as a link", () => {
      expect(html()).toMatch(
        /<a href="[^"]*\/linked" class="label">__LINKS_TO_A_PAGE<\/a>/,
      );
    });

    it("renders the title of an expanding section as plain text", () => {
      const value = html();
      expect(value).toContain('<span class="label">__ONLY_EXPANDS</span>');
      expect(value).not.toMatch(/<a[^>]*expander[^>]*class="label"/);
    });
  });

  it("should hide virtual section", async () => {
    const value = toHtml("", virtualCtx).value;
    expect(value).toContain("__I_AM_HERE");
    expect(value).not.toContain("__I_AM_NOT_HERE");
  });

  it("should apply default layout class when no layout is specified", () => {
    const defaultCtx: HyperbookContext = {
      ...ctx,
      navigation: {
        ...ctx.navigation,
        current: {
          ...ctx.navigation.current!,
          layout: undefined,
        },
      },
    };
    const value = toHtml("", defaultCtx).value;
    expect(value).toContain('class="main-grid"');
    expect(value).not.toContain("layout-wide");
    expect(value).not.toContain("layout-standalone");
  });

  it("should apply wide layout class when layout is set to wide", () => {
    const wideCtx: HyperbookContext = {
      ...ctx,
      navigation: {
        ...ctx.navigation,
        current: {
          ...ctx.navigation.current!,
          layout: "wide",
        },
      },
    };
    const value = toHtml("", wideCtx).value;
    expect(value).toContain('class="main-grid layout-wide"');
  });

  it("should apply default layout class when layout is explicitly set to default", () => {
    const defaultExplicitCtx: HyperbookContext = {
      ...ctx,
      navigation: {
        ...ctx.navigation,
        current: {
          ...ctx.navigation.current!,
          layout: "default",
        },
      },
    };
    const value = toHtml("", defaultExplicitCtx).value;
    expect(value).toContain('class="main-grid"');
    expect(value).not.toContain("layout-wide");
    expect(value).not.toContain("layout-standalone");
  });

  it("should apply standalone layout class when layout is set to standalone", () => {
    const standaloneCtx: HyperbookContext = {
      ...ctx,
      navigation: {
        ...ctx.navigation,
        current: {
          ...ctx.navigation.current!,
          layout: "standalone",
        },
      },
    };
    const value = toHtml("", standaloneCtx).value;
    expect(value).toContain('class="main-grid layout-standalone"');
  });

  it("should render breadcrumb when enabled globally", () => {
    const breadcrumbCtx: HyperbookContext = {
      ...ctx,
      config: {
        ...ctx.config,
        breadcrumb: true,
      },
      navigation: {
        ...ctx.navigation,
        current: {
          name: "Test Page",
          href: "/section/page",
        },
        sections: [
          {
            name: "Section",
            href: "/section",
            isEmpty: false,
            pages: [
              {
                name: "Test Page",
                href: "/section/page",
              },
            ],
            sections: [],
          },
        ],
        pages: [],
      },
    };
    const value = toHtml("", breadcrumbCtx).value;
    expect(value).toContain('class="breadcrumb"');
    expect(value).toContain('class="breadcrumb-home"');
    expect(value).toContain('class="breadcrumb-separator"');
    expect(value).toContain("Section");
    expect(value).toContain("Test Page");
  });

  it("should render breadcrumb with custom home and separator", () => {
    const breadcrumbCtx: HyperbookContext = {
      ...ctx,
      config: {
        ...ctx.config,
        breadcrumb: {
          home: ":star:",
          separator: "→",
        },
      },
      navigation: {
        ...ctx.navigation,
        current: {
          name: "Test Page",
          href: "/page",
        },
        sections: [],
        pages: [
          {
            name: "Test Page",
            href: "/page",
          },
        ],
      },
    };
    const value = toHtml("", breadcrumbCtx).value;
    expect(value).toContain("⭐");
    expect(value).toContain("→");
  });

  it("should not render breadcrumb when disabled", () => {
    const noBreadcrumbCtx: HyperbookContext = {
      ...ctx,
      config: {
        ...ctx.config,
        breadcrumb: false,
      },
      navigation: {
        ...ctx.navigation,
        current: {
          name: "Test Page",
          href: "/page",
        },
        sections: [],
        pages: [
          {
            name: "Test Page",
            href: "/page",
          },
        ],
      },
    };
    const value = toHtml("", noBreadcrumbCtx).value;
    expect(value).not.toContain('class="breadcrumb"');
  });

  it("should render empty section without link in breadcrumb", () => {
    const breadcrumbCtx: HyperbookContext = {
      ...ctx,
      config: {
        ...ctx.config,
        breadcrumb: true,
      },
      navigation: {
        ...ctx.navigation,
        current: {
          name: "Test Page",
          href: "/section/page",
        },
        sections: [
          {
            name: "Empty Section",
            href: "/section",
            isEmpty: true,
            pages: [
              {
                name: "Test Page",
                href: "/section/page",
              },
            ],
            sections: [],
          },
        ],
        pages: [],
      },
    };
    const value = toHtml("", breadcrumbCtx).value;
    expect(value).toContain('class="breadcrumb-item breadcrumb-empty"');
    expect(value).toContain("Empty Section");
  });

  it("should not render breadcrumb on root index page", () => {
    const rootCtx: HyperbookContext = {
      ...ctx,
      config: {
        ...ctx.config,
        breadcrumb: true,
      },
      navigation: {
        ...ctx.navigation,
        current: {
          name: "Home",
          href: "/",
        },
        sections: [],
        pages: [
          {
            name: "Home",
            href: "/",
          },
        ],
      },
    };
    const value = toHtml("", rootCtx).value;
    expect(value).not.toContain('class="breadcrumb"');
  });

  describe("navigation order", () => {
    // The order of the labels in the navigation, so a test reads like the
    // sidebar looks. A section is a <details>, a page an <a class="page">.
    const order = (navigation: Partial<HyperbookContext["navigation"]>) => {
      const html = String(
        toHtml("", {
          ...ctx,
          navigation: {
            ...ctx.navigation,
            sections: [],
            pages: [],
            ...navigation,
          },
        }).value,
      );
      // The breadcrumb is a <nav> too, and it comes first in the document.
      const start = html.indexOf("<nav>");
      const nav = html.slice(start, html.indexOf("</nav>", start));
      return [
        ...nav.matchAll(
          /class="page[^"]*" href="[^"]*">([^<]*)<|class="label">([^<]*)</g,
        ),
      ].map((m) => m[1] ?? m[2]);
    };

    const page = (name: string, index?: number) => ({
      name,
      href: "/" + name,
      index,
    });
    const section = (name: string, index?: number) => ({
      name,
      href: "/" + name,
      index,
      isEmpty: false,
      pages: [],
      sections: [],
    });

    it("puts a section between two pages by index", () => {
      expect(
        order({
          pages: [page("one", 1), page("three", 3)],
          sections: [section("two", 2)],
        }),
      ).toEqual(["one", "two", "three"]);
    });

    it("puts a page after a section by index", () => {
      expect(
        order({
          pages: [page("last", 9)],
          sections: [section("first", 1)],
        }),
      ).toEqual(["first", "last"]);
    });

    it("keeps pages before sections when nothing has an index", () => {
      expect(
        order({
          pages: [page("zebra"), page("apple")],
          sections: [section("beta"), section("alpha")],
        }),
      ).toEqual(["apple", "zebra", "alpha", "beta"]);
    });

    it("puts a subsection between two pages of its section", () => {
      // The pages of a section and its subsections share one order too, so the
      // sidebar keeps agreeing with the previous and next buttons.
      expect(
        order({
          sections: [
            {
              ...section("outer", 1),
              pages: [page("early", 1), page("late", 3)],
              sections: [section("middle", 2)],
            },
          ],
        }),
      ).toEqual(["outer", "early", "middle", "late"]);
    });

    it("puts a page before a section that shares its index", () => {
      expect(
        order({
          pages: [page("zebra", 1)],
          sections: [section("alpha", 1)],
        }),
      ).toEqual(["zebra", "alpha"]);
    });
  });
});
