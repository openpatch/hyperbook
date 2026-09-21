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
import { resolveDirectiveId } from "./directiveId";

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
    tagName: "code",
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

type PasswordGroupToken = {
  key: string;
  label: string;
  href?: string;
};

type PasswordGroup = PasswordGroupToken & {
  /** All entries below this group, used for the optional count. */
  entries: CollectedPassword[];
  /** Entries for which this is the final grouping level. */
  ownEntries: CollectedPassword[];
  children: Map<string, PasswordGroup>;
};

const groupValue = (
  entry: CollectedPassword,
  field: string,
): PasswordGroupToken[] => {
  const other = i18n.get("passwordlist-other");

  if (field === "section") {
    return entry.sectionPath?.length
      ? entry.sectionPath.map((label, index) => ({
          key: `section:${index}:${label}`,
          label,
        }))
      : [{ key: "section:other", label: other }];
  }
  if (field === "top-section") {
    const label = entry.sectionPath?.[0] || other;
    return [{ key: `top-section:${label}`, label }];
  }
  if (field === "page") {
    const label = pageLabel(entry) || other;
    return [
      {
        key: `page:${entry.href || entry.file || entry.key || label}`,
        label,
        href: entry.href,
      },
    ];
  }

  const value = entry[field as keyof CollectedPassword];
  const label = value == null || value === "" ? other : String(value);
  return [{ key: `${field}:${label}`, label }];
};

/** Build an insertion-ordered trie so any number of grouping levels compose. */
const groupPasswords = (
  entries: CollectedPassword[],
  fields: string[],
): PasswordGroup[] => {
  const root = new Map<string, PasswordGroup>();

  for (const entry of entries) {
    const tokens = fields.flatMap((field) => groupValue(entry, field));
    let groups = root;
    let group: PasswordGroup | undefined;
    for (const token of tokens) {
      group = groups.get(token.key);
      if (!group) {
        group = {
          ...token,
          entries: [],
          ownEntries: [],
          children: new Map(),
        };
        groups.set(token.key, group);
      }
      group.entries.push(entry);
      groups = group.children;
    }
    group?.ownEntries.push(entry);
  }

  return [...root.values()];
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

      const list = (
        listEntries: CollectedPassword[],
        listFormat: "ul" | "ol",
      ): ElementContent => ({
        type: "element",
        tagName: listFormat,
        properties: {},
        children: listEntries.map((entry) => ({
          type: "element",
          tagName: "li",
          properties: {},
          children: [
            {
              type: "element",
              tagName: "code",
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
      });
      const renderEntries = (
        groupEntries: CollectedPassword[],
      ): ElementContent =>
        format === "ul" || format === "ol"
          ? list(groupEntries, format)
          : table(groupEntries);

      const groupFields = groupBy
        ? String(groupBy)
            // Commas are the documented separator; slashes are accepted too
            // because they read naturally for nested section/page paths.
            .split(/[,/]/)
            .map((field) => field.trim())
            .filter(Boolean)
            // `section` already expands the complete navigation ancestry.
            // Repeating it (for example section/section/page) should not
            // duplicate every ancestor in the output.
            .filter(
              (field, index, fields) =>
                field !== "section" || fields[index - 1] !== "section",
            )
        : [];
      if (groupFields.length > 0) {
        const collapsible = Object.prototype.hasOwnProperty.call(
          attributes,
          "collapsible",
        );
        const collapseValue = String(attributes.collapsible ?? "");
        const collapseLevels = !collapsible
          ? 0
          : collapseValue === "all"
            ? Number.POSITIVE_INFINITY
            : collapseValue === ""
              ? 1
              : Math.max(0, Number(collapseValue) || 1);
        const showCount = Object.prototype.hasOwnProperty.call(
          attributes,
          "showCount",
        );
        const collapsibleId = collapsible
          ? resolveDirectiveId(file, node)
          : undefined;
        const renderGroup = (
          group: PasswordGroup,
          depth: number,
          groupPath: string,
          duplicateLabel = false,
        ): ElementContent => {
          const itemLabel = i18n.get(
            group.entries.length === 1
              ? "passwordlist-item"
              : "passwordlist-items",
          );
          const label =
            duplicateLabel && group.href
              ? `${group.label} (${ctx.makeUrl(group.href, "book")})`
              : group.label;
          const title = `${label}${
            showCount ? ` (${group.entries.length} ${itemLabel})` : ""
          }`;
          const titleChildren: ElementContent[] = group.href
            ? [
                {
                  type: "element",
                  tagName: "a",
                  properties: { href: ctx.makeUrl(group.href, "book") },
                  children: [{ type: "text", value: title }],
                },
              ]
            : [{ type: "text", value: title }];
          const content: ElementContent[] = [
            ...(group.ownEntries.length
              ? [renderEntries(group.ownEntries)]
              : []),
            ...(() => {
              const children = [...group.children.values()];
              const labels = new Map<string, number>();
              for (const child of children) {
                labels.set(child.label, (labels.get(child.label) || 0) + 1);
              }
              return children.map((child) =>
                renderGroup(
                  child,
                  depth + 1,
                  `${groupPath}/${child.key}`,
                  (labels.get(child.label) || 0) > 1,
                ),
              );
            })(),
          ];

          if (depth < collapseLevels) {
            return {
              type: "element",
              tagName: "details",
              properties: {
                class: "directive-collapsible",
                "data-id": `${collapsibleId}:group:${encodeURIComponent(groupPath)}`,
              },
              children: [
                {
                  type: "element",
                  tagName: "summary",
                  properties: {},
                  children: titleChildren,
                },
                {
                  type: "element",
                  tagName: "div",
                  properties: { class: "content" },
                  children: content,
                },
              ],
            };
          }

          return {
            type: "element",
            tagName: "section",
            properties: { class: "passwordlist-group" },
            children: [
              {
                type: "element",
                tagName: `h${Math.min(2 + depth, 6)}`,
                properties: {},
                children: titleChildren,
              },
              ...content,
            ],
          };
        };
        data.hChildren = groupPasswords(entries, groupFields).map((group) =>
          renderGroup(group, 0, group.key),
        );
        continue;
      }

      data.hChildren = [renderEntries(entries)];
    }
  };
};
