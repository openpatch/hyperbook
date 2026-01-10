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
});
