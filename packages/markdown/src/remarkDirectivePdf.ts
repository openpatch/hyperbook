// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext, elementCdn, hostedRuntime } from "@hyperbook/types";
import { Root } from "mdast";
import { Element, ElementContent } from "hast";
import { toHast } from "mdast-util-to-hast";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { elementAssetUrl } from "./elementAssets";
import { i18n } from "./i18n";
import { icon } from "./icons";
import { cssHeight } from "./ideWorkspace";
import { resolveFile } from "./helper";
import { parseTypstInputs, registerTypstJob, typstOutputHref } from "./typstJobs";
import {
  expectDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";

/*
 * A PDF document on a page:
 *
 *   ::pdf[Skript]{src="skript.pdf"}
 *   ::pdf[Folien]{src="folien.pdf" view="slides"}
 *
 * A `.typ` source is built into a PDF by the build (see typstJobs.ts); from
 * then on it is shown like any other PDF.
 *
 * pdf.js draws the pages in the browser (views `pages`, `slides`, `thumb`);
 * `embed` uses the browser's own viewer in an <iframe> and `button` shows
 * only a download button. Without JavaScript every view is a link to the
 * file.
 */

export const PDF_VIEWS = ["pages", "slides", "thumb", "embed", "button"] as const;
export type PdfView = (typeof PDF_VIEWS)[number];

/**
 * A page range like `1-2` or `3,5-6` as a list of [first, last] pairs, or
 * null when it is not one. Pages count from 1; `5-` runs to the last page.
 */
export function parsePageRanges(
  value: string,
): [number, number | null][] | null {
  const ranges: [number, number | null][] = [];
  for (const part of value.split(",")) {
    const match = /^\s*(\d+)\s*(?:(-)\s*(\d+)?)?\s*$/.exec(part);
    if (!match) return null;
    const first = Number(match[1]);
    const last = match[2] ? (match[3] ? Number(match[3]) : null) : first;
    if (first < 1 || (last !== null && last < first)) return null;
    ranges.push([first, last]);
  }
  return ranges.length > 0 ? ranges : null;
}

/** The ranges back as text, the way the client reads them. */
const formatPageRanges = (ranges: [number, number | null][]) =>
  ranges
    .map(([first, last]) =>
      last === first ? `${first}` : `${first}-${last ?? ""}`,
    )
    .join(",");

const isFalse = (value: unknown) =>
  value === false || value === "false" || value === "no" || value === "0";

export default (ctx: HyperbookContext) => () => {
  const name = "pdf";
  const cdn = elementCdn(ctx.config, name, hostedRuntime(ctx, name));

  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (!isDirective(node) || node.name !== name) return;

      const data = node.data || (node.data = {});
      expectDirective(node, file, name, ["leaf"]);

      const attributes = node.attributes || {};
      const src = (attributes.src ?? "").trim();
      const label = (toHast(node) as Element)?.children ?? [];
      const title: ElementContent[] =
        label.length > 0 ? label : [{ type: "text", value: src }];

      if (!src) {
        file.message(`::pdf needs a src, e.g. ::pdf[Title]{src="file.pdf"}`, node);
        data.hName = "div";
        data.hProperties = { class: "directive-pdf pdf-missing" };
        data.hChildren = title;
        return;
      }

      let view: PdfView = "pages";
      if (attributes.view) {
        if ((PDF_VIEWS as readonly string[]).includes(attributes.view)) {
          view = attributes.view as PdfView;
        } else {
          file.message(
            `::pdf does not know view="${attributes.view}"; use one of ${PDF_VIEWS.join(", ")}`,
            node,
          );
        }
      }

      let pages: string | undefined;
      if (attributes.pages) {
        const ranges = parsePageRanges(attributes.pages);
        if (ranges) pages = formatPageRanges(ranges);
        else
          file.message(
            `::pdf cannot read pages="${attributes.pages}"; write ranges like "1-2" or "3,5-6"`,
            node,
          );
      }

      let href = ctx.makeUrl(src, "public", ctx.navigation.current || undefined);

      const isTypst = /\.typ$/i.test(src.split(/[?#]/)[0]!);
      let inputs: Record<string, string> = {};
      if (attributes.inputs !== undefined && attributes.inputs !== "") {
        if (!isTypst) {
          file.message(`::pdf "inputs" only applies to a .typ source; "${src}" is built already`, node);
        } else {
          const parsed = parseTypstInputs(String(attributes.inputs));
          if ("error" in parsed) {
            file.message(`::pdf cannot read inputs="${attributes.inputs}": ${parsed.error}`, node);
          } else {
            inputs = parsed.inputs;
          }
        }
      }
      if (isTypst) {
        const source = resolveFile(src, ctx);
        if (!source) {
          file.message(`::pdf cannot find the Typst document "${src}"`, node);
        } else {
          const out = typstOutputHref(source.href, inputs);
          registerTypstJob(file, { src: source.relative, out, inputs });
          href = ctx.makeUrl(out, "public");
        }
      }
      const download = !isFalse(attributes.download);

      // Only a button: the download directive's markup and styles, and no
      // pdf.js at all.
      if (view === "button") {
        if (attributes.pages || attributes.download !== undefined)
          file.message(
            `::pdf with view="button" only offers the download; "pages" and "download" have no effect`,
            node,
          );
        registerDirective(file, "download", ["client.js"], ["style.css"], []);
        data.hName = "a";
        data.hProperties = {
          class: "directive-download directive-pdf-button",
          target: "_blank",
          rel: ["noopener", "noreferrer"],
          href,
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "span",
            properties: { class: "icon" },
            children: [icon("download")],
          },
          {
            type: "element",
            tagName: "span",
            properties: { class: "label" },
            children: title,
          },
        ];
        return;
      }

      const usesPdfJs = view !== "embed";
      registerDirective(file, name, usesPdfJs ? ["client.js"] : [], ["style.css"], []);

      const height =
        attributes.height !== undefined && attributes.height !== ""
          ? cssHeight(attributes.height)
          : undefined;

      const downloadButton: Element = {
        type: "element",
        tagName: "a",
        properties: {
          class: "pdf-download",
          href,
          download: true,
          title: i18n.get("pdf-download"),
          "aria-label": i18n.get("pdf-download"),
        },
        children: [icon("download")],
      };

      const header: Element = {
        type: "element",
        tagName: "div",
        properties: { class: "pdf-header" },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { class: "pdf-title" },
            children: title,
          },
          ...(download ? [downloadButton] : []),
        ],
      };

      // What a reader without JavaScript (or with a failed script) gets, and
      // what the client replaces with the pages.
      const fallback: Element = {
        type: "element",
        tagName: "a",
        properties: {
          class: "pdf-fallback",
          href,
          target: "_blank",
          rel: ["noopener", "noreferrer"],
        },
        children: title,
      };

      const firstPage = pages ? Number(pages.split(/[-,]/)[0]) : 1;
      const viewer: Element =
        view === "embed"
          ? {
              type: "element",
              tagName: "iframe",
              properties: {
                class: "pdf-embed",
                src: firstPage > 1 ? `${href}#page=${firstPage}` : href,
                title: i18n.get("pdf-document"),
                loading: "lazy",
              },
              children: [fallback],
            }
          : {
              type: "element",
              tagName: "div",
              properties: { class: "pdf-viewer" },
              children: [fallback],
            };

      data.hName = "div";
      data.hProperties = {
        class: `directive-pdf pdf-view-${view}`,
        "data-view": view,
        "data-src": href,
        ...(pages ? { "data-pages": pages } : {}),
        ...(usesPdfJs && cdn
          ? {
              "data-runtime": JSON.stringify({
                base: elementAssetUrl(ctx, name, ""),
                lib: elementAssetUrl(ctx, name, "pdf.min.mjs"),
                worker: elementAssetUrl(ctx, name, "pdf.worker.min.mjs"),
              }),
            }
          : {}),
        ...(height ? { style: `--pdf-height: ${height}` } : {}),
      };
      data.hChildren = [header, viewer];
    });
  };
};
