// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import {
  HyperbookContext,
  HyperbookPage,
  HyperbookSection,
} from "@hyperbook/types";
import { registerBasicHelpers } from "@hyperbook/fs";
import handlebars from "handlebars";
import fs from "fs";
import path from "path";
import { Node, Root } from "mdast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import {
  expectLeafDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { remark } from "./process";
import { parseQuery, evaluateQuery, createPageSorter } from "./queryParser";

const getPageList = (
  sections: HyperbookSection[],
  pages: HyperbookPage[],
): HyperbookPage[] => {
  let pageList = [...pages.filter(p => !p.isEmpty)];

  for (const section of sections) {
    pageList = [
      ...pageList,
      ...getPageList(section.sections, section.pages),
    ];
  }

  return pageList;
};

const clusterPages = (
  pages: HyperbookPage[],
): Record<string, HyperbookPage[]> => {
  const cluster: Record<string, HyperbookPage[]> = {};

  for (let page of pages) {
    const letter = page.name[0].toUpperCase();
    if (!cluster[letter]) {
      cluster[letter] = [];
    }

    cluster[letter].push(page);
  }

  return cluster;
};

export default (ctx: HyperbookContext) => () => {
  const name = "pagelist";
  return (tree: Root, file: VFile) => {
    const pageList = getPageList(ctx.navigation.sections, ctx.navigation.pages);
    pageList.push(...ctx.navigation.glossary);
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});
        const attributes = node.attributes || {};
        const {
          format = "ul",
          orderBy = "name:asc",
          source = "href(.*)",
          limit = null,
        } = attributes;

        expectLeafDirective(node, file, name);
        registerDirective(file, name, [], ["style.css"], []);

        data.hName = "div";
        data.hProperties = {
          class: "directive-pagelist",
        };

        // Parse and evaluate the query
        const query = parseQuery(source || "href(.*)");
        let filteredPages = pageList.filter((p) => evaluateQuery(query, p as HyperbookPage & Record<string, unknown>));

        // Sort pages
        const sorter = createPageSorter(orderBy || "name:asc");
        filteredPages = filteredPages.sort((p1, p2) => sorter(p1 as Record<string, unknown>, p2 as Record<string, unknown>));

        if (limit !== null) {
          filteredPages = filteredPages.slice(0, Number(limit));
        }

        filteredPages = filteredPages.map((p) => ({
          ...p,
          href: ctx.makeUrl(p.href || "", "book"),
        }));

        if (format?.startsWith("#")) {
          const snippetId = format.slice(1);
          const snippetFile = fs.readFileSync(
            path.join(ctx.root, "snippets", snippetId + ".md.hbs"),
            { encoding: "utf8" },
          );
          registerBasicHelpers(handlebars);
          const template = handlebars.compile(snippetFile);
          const content = template({ pages: filteredPages });
          const contentTree = remark(ctx).parse(content);
          node.children = contentTree.children as any;
        } else if (format === "ul") {
          data.hChildren = [
            {
              type: "element",
              tagName: "ul",
              properties: {},
              children: filteredPages.map((p) => ({
                type: "element",
                tagName: "li",
                properties: {},
                children: [
                  {
                    type: "element",
                    tagName: "a",
                    properties: {
                      href: p.href,
                    },
                    children: [
                      {
                        type: "text",
                        value: p.name,
                      },
                    ],
                  },
                ],
              })),
            },
          ];
        } else if (format === "ol") {
          data.hChildren = [
            {
              type: "element",
              tagName: "ol",
              properties: {},
              children: filteredPages.map((p) => ({
                type: "element",
                tagName: "li",
                properties: {},
                children: [
                  {
                    type: "element",
                    tagName: "a",
                    properties: {
                      href: p.href,
                    },
                    children: [
                      {
                        type: "text",
                        value: p.name,
                      },
                    ],
                  },
                ],
              })),
            },
          ];
        } else if (format === "glossary") {
          const cluster = clusterPages(filteredPages);

          data.hChildren = Object.keys(cluster)
            .sort((a, b) => a.localeCompare(b))
            .map((letter) => ({
              type: "element",
              tagName: "div",
              properties: {
                class: "container",
              },
              children: [
                {
                  type: "element",
                  tagName: "div",
                  properties: {
                    class: "letter",
                  },
                  children: [
                    {
                      type: "text",
                      value: letter,
                    },
                  ],
                },
                {
                  type: "element",
                  tagName: "ul",
                  properties: {
                    class: "terms",
                  },
                  children: cluster[letter].map((term) => ({
                    type: "element",
                    tagName: "li",
                    properties: {},
                    children: [
                      {
                        type: "element",
                        tagName: "a",
                        properties: {
                          class: "term",
                          href: term.href,
                        },
                        children: [
                          {
                            type: "text",
                            value: term.name,
                          },
                        ],
                      },
                    ],
                  })),
                },
              ],
            }));
        }
      }
    });
  };
};
