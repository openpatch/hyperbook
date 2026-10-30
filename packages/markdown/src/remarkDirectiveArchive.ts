// Register directive nodes in mdast:
/// <reference types="mdast-util-directive" />
//
import { HyperbookContext } from "@hyperbook/types";
import { Root } from "mdast";
import { Element } from "hast";
import { posix } from "path";
import { visit } from "unist-util-visit";
import { VFile } from "vfile";
import { icon } from "./icons";
import {
  expectDirective,
  isDirective,
  registerDirective,
} from "./remarkHelper";
import { toHast } from "mdast-util-to-hast";

/**
 * One `src=dest` pair of an `include` attribute: pull `src` from the book into
 * the zip at `dest` when the archive is built.
 */
export interface ArchiveInclude {
  /** Source, relative to the book root, always starting with a slash. */
  src: string;
  /** Destination inside the zip, relative, with posix separators. */
  dest: string;
  /** Markdown file that declared the include, so build errors name it. */
  source?: string;
}

/**
 * Parses the `include` attribute: a comma-separated list of `src=dest` pairs.
 *
 * Everything a typo in the attribute can be blamed on is checked here, where
 * the message can still point at the offending directive — file-level checks
 * (does the source exist, does the destination collide) happen when the zip is
 * written and need the book root.
 */
export function parseArchiveIncludes(
  value: string,
  file: VFile,
  node: Parameters<typeof expectDirective>[0],
): ArchiveInclude[] {
  const source =
    typeof file.path === "string"
      ? file.path
      : file.history?.[file.history.length - 1];

  const fail = (reason: string): never => file.fail(reason, node);

  return value.split(",").map((pair) => {
    const equals = pair.indexOf("=");
    if (equals === -1) {
      fail(
        `Invalid include "${pair.trim()}" on the archive directive: every entry must be a src=dest pair, e.g. include="/book/chapter/assets=assets".`,
      );
    }
    const src = pair.slice(0, equals).trim();
    const dest = pair.slice(equals + 1).trim();

    if (!src.startsWith("/") || src.includes("\\")) {
      fail(
        `Invalid include source "${src}" on the archive directive: it must be a path relative to the book root that starts with a slash and uses / as separator, e.g. "/book/chapter/assets".`,
      );
    }
    const normalizedSrc = posix.normalize(src);
    if (normalizedSrc === "/" || src.split("/").includes("..")) {
      fail(
        `Invalid include source "${src}" on the archive directive: it must stay inside the book root and cannot be the book root itself.`,
      );
    }

    if (dest === "" || dest.startsWith("/") || dest.includes("\\")) {
      fail(
        `Invalid include destination "${dest}" on the archive directive: it must be a relative path inside the zip, e.g. "assets" or "src/main/java".`,
      );
    }
    const normalizedDest = posix.normalize(dest);
    if (normalizedDest === "." || normalizedDest.split("/").includes("..")) {
      fail(
        `Invalid include destination "${dest}" on the archive directive: it must stay inside the zip and cannot contain "..".`,
      );
    }

    return { src: normalizedSrc, dest: normalizedDest, source };
  });
}

export default (ctx: HyperbookContext) => () => {
  const name = "archive";
  return (tree: Root, file: VFile) => {
    visit(tree, function (node) {
      if (isDirective(node)) {
        if (node.name !== name) return;

        const data = node.data || (node.data = {});

        expectDirective(node, file, name, ["text", "leaf"]);
        registerDirective(file, name, ["client.js"], ["style.css"], []);

        const { name: archiveName = "", include } = node.attributes || {};
        data.hName = "a";
        data.hProperties = {
          class: "directive-archive",
          target: "_blank",
          rel: ["noopener", "noreferrer"],
          href: ctx.makeUrl(archiveName + ".zip", "archive"),
        };
        data.hChildren = [
          {
            type: "element",
            tagName: "span",
            properties: {
              class: "icon",
            },
            children: [icon("download")],
          },
          {
            type: "element",
            tagName: "span",
            properties: {
              class: "label",
            },
            children: (toHast(node) as Element)?.children,
          },
        ];

        // The rendered link is the same with or without includes — the
        // attribute only changes what goes into the zip, so it is collected on
        // the vfile for the build to pick up.
        if (include !== undefined && include !== null) {
          if (String(include).trim() === "") {
            file.fail(
              `The archive directive has an empty include attribute. Remove it, or list src=dest pairs, e.g. include="/book/chapter/assets=assets".`,
              node,
            );
          }
          const includes = parseArchiveIncludes(String(include), file, node);
          if (!file.data.archiveIncludes) {
            file.data.archiveIncludes = {};
          }
          const byArchive = file.data.archiveIncludes as Record<
            string,
            ArchiveInclude[]
          >;
          const key = archiveName ?? "";
          if (!byArchive[key]) {
            byArchive[key] = [];
          }
          byArchive[key].push(...includes);
        }
      }
    });
  };
};
