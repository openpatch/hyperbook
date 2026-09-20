// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext, HyperbookSection } from "@hyperbook/types";
import { registerBasicHelpers } from "@hyperbook/fs";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";
import { ElementContent } from "hast";
import { Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { remark } from "./process";
import { parseQuery, evaluateQuery, createPageSorter } from "./queryParser";
import { collectPasswords, CollectedPassword } from "./collectPasswords";
import { i18n } from "./i18n";

/** The section that contains a href, innermost first. */
const findSection = (
  sections: HyperbookSection[],
  href: string,
): HyperbookSection | undefined => {
  let best: HyperbookSection | undefined;

  const walk = (level: HyperbookSection[]) => {
    for (const section of level) {
      if (section.href && href.startsWith(section.href)) {
        // Longest matching prefix wins, so a nested section beats its parent.
        if (!best || section.href.length > (best.href?.length || 0)) {
          best = section;
        }
      }
      walk(section.sections);
    }
  };

  walk(sections);
  return best;
};

/** Name of the page or section a href belongs to, for a readable link label. */
const findName = (ctx: HyperbookContext, href: string): string | undefined => {
  const walk = (
    pages: { href?: string; name: string }[],
    sections: HyperbookSection[],
  ): string | undefined => {
    for (const page of pages) {
      if (page.href === href) return page.name;
    }
    for (const section of sections) {
      if (section.href === href) return section.name;
      const nested = walk(section.pages, section.sections);
      if (nested) return nested;
    }
  };

  return (
    walk(ctx.navigation.pages, ctx.navigation.sections) ||
    walk(ctx.navigation.glossary, [])
  );
};

const cell = (children: ElementContent[]): ElementContent => ({
  type: "element",
  tagName: "td",
  properties: {},
  children,
});

const headerCell = (value: string): ElementContent => ({
  type: "element",
  tagName: "th",
  properties: {},
  children: [{ type: "text", value }],
});

const describe = (entry: CollectedPassword): string =>
  entry.description || entry.name || "";

const passwordContent = (entry: CollectedPassword): ElementContent[] => [
  {
    type: "element",
    tagName: "span",
    properties: { class: "password" },
    children: [{ type: "text", value: entry.password || "" }],
  },
];

const pageLabel = (entry: CollectedPassword): string => {
  const innerSection = entry.sectionPath?.at(-1);
  if (innerSection && innerSection !== entry.pageName) {
    return `${innerSection} – ${entry.pageName || entry.href || ""}`;
  }
  return entry.pageName || entry.href || entry.file || "";
};

/** Plain-text location, for snippets and for entries with nowhere to link. */
const where = (entry: CollectedPassword, ctx: HyperbookContext): string =>
  entry.href ? ctx.makeUrl(entry.href, "book") : entry.file || entry.type;

/**
 * The location as a link when there is a page to open.
 *
 * A password list is something you read while looking for the page it belongs
 * to, so the location is worth following rather than just naming. Registry
 * entries have no page and stay plain text.
 */
const whereContent = (
  entry: CollectedPassword,
  ctx: HyperbookContext,
): ElementContent[] => {
  if (!entry.href) {
    return [{ type: "text", value: entry.file || entry.type }];
  }

  return [
    {
      type: "element",
      tagName: "a",
      properties: { href: ctx.makeUrl(entry.href, "book") },
      children: [
        {
          type: "text",
          value: findName(ctx, entry.href) || ctx.makeUrl(entry.href, "book"),
        },
      ],
    },
  ];
};

export default (ctx: HyperbookContext) => () => {
  const name = "passwordlist";

  return async (tree: Root, file: VFile) => {
    const nodes: any[] = [];
    visit(tree, function (node) {
      if (isDirective(node) && node.name === name) {
        nodes.push(node);
      }
    });
    if (nodes.length === 0) return;

    const report = await collectPasswords(ctx.root);

    for (const node of nodes) {
      const data = node.data || (node.data = {});
      const attributes = node.attributes || {};
      const {
        scope = "all",
        source = null,
        type = "all",
        format = "table",
        orderBy = "key:asc",
        limit = null,
        groupBy = null,
        columns: columnsAttribute = null,
      } = attributes;

      expectLeafDirective(node, file, name);
      registerDirective(file, name, [], ["style.css"], []);

      data.hName = "div";
      data.hProperties = { class: "directive-passwordlist" };

      let entries = report.entries;

      if (type !== "all") {
        const types = type.split(",").map((t: string) => t.trim());
        entries = entries.filter((e) => types.includes(e.type));
      }

      const currentHref = ctx.navigation.current?.href;
      if (scope === "page") {
        entries = entries.filter((e) => e.href && e.href === currentHref);
      } else if (scope === "section") {
        const section = currentHref
          ? findSection(ctx.navigation.sections, currentHref)
          : undefined;
        const prefix = section?.href;
        entries = prefix
          ? entries.filter((e) => e.href && e.href.startsWith(prefix))
          : [];
      }

      if (source) {
        const query = parseQuery(source);
        entries = entries.filter((e) =>
          evaluateQuery(query, {
            ...e,
            // The query language reads `name`; fall back to the key so
            // `name(...)` works for registry entries too.
            name: e.name || e.key || "",
          } as any),
        );
      }

      if (orderBy === "navigation") {
        entries = [...entries].sort(
          (a, b) =>
            (a.navigationIndex ?? Number.MAX_SAFE_INTEGER) -
              (b.navigationIndex ?? Number.MAX_SAFE_INTEGER) ||
            (a.line ?? 0) - (b.line ?? 0),
        );
      } else {
        const sorter = createPageSorter(orderBy);
        entries = [...entries].sort((a, b) =>
          sorter(a as Record<string, unknown>, b as Record<string, unknown>),
        );
      }

      if (limit !== null) {
        entries = entries.slice(0, Number(limit));
      }

      if (format?.startsWith("#")) {
        const snippetId = format.slice(1);
        const snippetFile = fs.readFileSync(
          path.join(ctx.root, "snippets", snippetId + ".md.hbs"),
          { encoding: "utf8" },
        );
        registerBasicHelpers(handlebars);
        const template = handlebars.compile(snippetFile);
        const content = template({
          passwords: entries.map((e) => ({ ...e, where: where(e, ctx) })),
        });
        const contentTree = remark(ctx).parse(content);
        node.children = contentTree.children as any;
        continue;
      }

      if (entries.length === 0) {
        data.hChildren = [
          {
            type: "element",
            tagName: "p",
            properties: { class: "empty" },
            children: [{ type: "text", value: i18n.get("passwordlist-empty") }],
          },
        ];
        continue;
      }

      const columns: string[] = (
        columnsAttribute || "password,where,description"
      )
        .split(",")
        .map((column: string) => column.trim())
        .filter(Boolean);
      const columnTitle = (column: string): string => {
        if (column === "password") return i18n.get("passwordlist-password");
        if (column === "where") return i18n.get("passwordlist-where");
        if (column === "description")
          return i18n.get("passwordlist-description");
        if (column === "context") return i18n.get("passwordlist-context");
        return column;
      };
      const columnContent = (
        entry: CollectedPassword,
        column: string,
      ): ElementContent[] => {
        if (column === "password") return passwordContent(entry);
        if (column === "where") return whereContent(entry, ctx);
        if (column === "description") {
          return [{ type: "text", value: describe(entry) }];
        }
        if (column === "context") {
          return [{ type: "text", value: entry.context || entry.name || "" }];
        }
        const value = entry[column as keyof CollectedPassword];
        return [{ type: "text", value: value == null ? "" : String(value) }];
      };
      const table = (tableEntries: CollectedPassword[]): ElementContent => ({
        type: "element",
        tagName: "table",
        properties: {},
        children: [
          {
            type: "element",
            tagName: "thead",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "tr",
                properties: {},
                children: columns.map((column) =>
                  headerCell(columnTitle(column)),
                ),
              },
            ],
          },
          {
            type: "element",
            tagName: "tbody",
            properties: {},
            children: tableEntries.map((entry) => ({
              type: "element",
              tagName: "tr",
              properties: {},
              children: columns.map((column) =>
                cell(columnContent(entry, column)),
              ),
            })),
          },
        ],
      });

      if (groupBy === "top-section,page") {
        const grouped = new Map<string, Map<string, CollectedPassword[]>>();
        for (const entry of entries) {
          const section =
            entry.sectionPath?.[0] || i18n.get("passwordlist-other");
          const page = entry.href || entry.file || entry.key || "";
          if (!grouped.has(section)) grouped.set(section, new Map());
          const pages = grouped.get(section)!;
          pages.set(page, [...(pages.get(page) || []), entry]);
        }
        const collapsible = Object.prototype.hasOwnProperty.call(
          attributes,
          "collapsible",
        );
        const showCount = Object.prototype.hasOwnProperty.call(
          attributes,
          "showCount",
        );
        data.hChildren = [...grouped.entries()].map(([section, pages]) => {
          const sectionEntries = [...pages.values()].flat();
          const itemLabel = i18n.get(
            sectionEntries.length === 1
              ? "passwordlist-item"
              : "passwordlist-items",
          );
          const title = `${section}${
            showCount
              ? ` (${sectionEntries.length} ${itemLabel})`
              : ""
          }`;
          const content: ElementContent[] = [...pages.values()].flatMap(
            (pageEntries) => [
              {
                type: "element",
                tagName: "h3",
                properties: {},
                children: pageEntries[0].href
                  ? [
                      {
                        type: "element",
                        tagName: "a",
                        properties: {
                          href: ctx.makeUrl(pageEntries[0].href, "book"),
                        },
                        children: [
                          { type: "text", value: pageLabel(pageEntries[0]) },
                        ],
                      },
                    ]
                  : [{ type: "text", value: pageLabel(pageEntries[0]) }],
              },
              table(pageEntries),
            ],
          );
          return collapsible
            ? {
                type: "element" as const,
                tagName: "details",
                properties: { class: "passwordlist-group" },
                children: [
                  {
                    type: "element" as const,
                    tagName: "summary",
                    properties: {},
                    children: [{ type: "text" as const, value: title }],
                  },
                  {
                    type: "element" as const,
                    tagName: "div",
                    properties: { class: "content" },
                    children: content,
                  },
                ],
              }
            : {
                type: "element" as const,
                tagName: "section",
                properties: { class: "passwordlist-group" },
                children: [
                  {
                    type: "element" as const,
                    tagName: "h2",
                    properties: {},
                    children: [{ type: "text" as const, value: title }],
                  },
                  ...content,
                ],
              };
        });
        continue;
      }

      if (format === "ul" || format === "ol") {
        data.hChildren = [
          {
            type: "element",
            tagName: format,
            properties: {},
            children: entries.map((entry) => ({
              type: "element",
              tagName: "li",
              properties: {},
              children: [
                {
                  type: "element",
                  // Deliberately not <code>: rehypePrettyCode picks up every
                  // code element and wraps it in a highlighted figure with a
                  // copy button and an injected stylesheet.
                  tagName: "span",
                  properties: { class: "password" },
                  children: [{ type: "text", value: entry.password || "" }],
                },
                { type: "text", value: " " },
                ...whereContent(entry, ctx),
                ...(describe(entry)
                  ? [
                      {
                        type: "text" as const,
                        value: ` — ${describe(entry)}`,
                      },
                    ]
                  : []),
              ],
            })),
          },
        ];
        continue;
      }

      data.hChildren = [table(entries)];
    }
  };
};
