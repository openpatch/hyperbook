/// <reference types="mdast-util-directive" />
import {
  HyperbookPage,
  HyperbookSection,
  PasswordEntry as RegistryEntry,
  ProtectReference,
} from "@hyperbook/types";
import {
  getPasswords,
  withReferencedKeys,
  vfile,
  hyperbook as hyperbookFs,
} from "@hyperbook/fs";
import { Root } from "mdast";
import { unified } from "unified";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";
import fs from "fs/promises";
import remarkParse from "./remarkParse";
import { readProtectReference } from "./remarkPageProtect";

/** Where a password came from in the book. */
export type PasswordOrigin = "registry" | "section" | "page" | "block";

export type CollectedPassword = {
  /** Registry key, when the password is referenced rather than inline. */
  key?: string;
  /** Undefined when the key is referenced but has no value anywhere. */
  password?: string;
  resolvedFrom?: "inline" | "file" | "env";
  name?: string;
  /** Nearest task label or heading for a protected block. */
  context?: string;
  pageName?: string;
  /** Ancestor section names, outermost first. */
  sectionPath?: string[];
  /** Position in the book navigation, used by orderBy="navigation". */
  navigationIndex?: number;
  description?: string;
  type: PasswordOrigin;
  /** Page or section this belongs to. */
  href?: string;
  /** Source file, relative to the book root. */
  file?: string;
  line?: number;
  /** Unlock group id, for blocks. */
  id?: string;
  /** True when a page inherited its protection from an ancestor section. */
  inherited?: boolean;
};

export type PasswordReport = {
  entries: CollectedPassword[];
  /** Registry keys referenced by the book that have no value. */
  missing: CollectedPassword[];
  /** Registry keys the book never references. */
  unused: string[];
  /** Groups of keys that share the same password value. */
  duplicates: string[][];
  /** Registry file that was read, if any. */
  registryFile?: string;
};

/**
 * Parses just enough to find `:::protect` blocks.
 *
 * Deliberately not the full pipeline: this runs over every file in the book,
 * and the directives, images and code highlighting are all irrelevant here.
 */
const parser = unified().use(remarkParse).use(remarkDirective);

/**
 * Whether a page may hold a `:::protect` block. Most pages of a book do not,
 * and parsing them is most of the time a `::passwordlist` takes on a large
 * book. Only rules pages out: a false hit just gets parsed.
 */
const mayProtect = (markdown: string) => /:::[ \t]*protect/.test(markdown);

const FRONTMATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/** The protect blocks of a page, without what the page's metadata adds. */
type Block = Omit<CollectedPassword, "file" | "href">;

/**
 * The protect blocks of a page, each with the nearest heading (from h2) or
 * task label before it as its context, unless it names itself.
 *
 * `source` is the file as written, frontmatter and all, which is what the
 * contexts are read from; `markdown` the page's content. Lines count in the
 * content. When the content is the end of the source, as for every plain
 * page, one parse serves both.
 */
const collectBlocks = (markdown: string, source = markdown): Block[] => {
  const sourceTree = parser.parse(source) as Root;
  parser.runSync(sourceTree);
  // Lines of the source before the content (its frontmatter).
  const suffix = source.endsWith(markdown);
  const lineOffset = suffix
    ? source.slice(0, source.length - markdown.length).split("\n").length - 1
    : 0;
  let contentTree: Root | null = null;
  if (!suffix) {
    contentTree = parser.parse(markdown) as Root;
    parser.runSync(contentTree);
  }

  // The frontmatter parses as markdown, too: "name: X" over its closing
  // "---" is a heading, which is no context.
  const frontmatterEnd = FRONTMATTER.exec(source)?.[0].length ?? 0;
  const headings: { offset: number; value: string }[] = [];
  const tasks: { offset: number; value: string }[] = [];
  const contexts: (string | undefined)[] = [];
  const sourceBlocks: any[] = [];
  visit(sourceTree, (node: any) => {
    const offset = node.position?.start?.offset;
    if (typeof offset !== "number" || offset < frontmatterEnd) return;
    if (node.type === "heading" && node.depth >= 2) {
      headings.push({ offset, value: toString(node).trim() });
    }
    if (node.type === "containerDirective" && node.name === "snippet") {
      const id = node.attributes?.id || node.attributes?.["#"];
      if (id !== "aufgabe") return;
      const first = node.children?.[0];
      const strong = first?.children?.find(
        (child: any) => child.type === "strong",
      );
      const value = strong ? toString(strong).trim() : "";
      if (value) tasks.push({ offset, value });
    }
    if (node.type === "containerDirective" && node.name === "protect") {
      sourceBlocks.push(node);
      const heading = headings.filter((item) => item.offset < offset).at(-1);
      const task = tasks.filter((item) => item.offset < offset).at(-1);
      contexts.push(
        node.attributes?.name ||
          (task && (!heading || task.offset > heading.offset)
            ? task.value
            : heading?.value),
      );
    }
  });

  // The blocks themselves: those of the source when it holds the content,
  // shifted to the content's lines; otherwise those of the content.
  const blocks: { node: any; line?: number }[] = [];
  if (contentTree) {
    visit(contentTree, (node: any) => {
      if (node.type === "containerDirective" && node.name === "protect") {
        blocks.push({ node, line: node.position?.start?.line });
      }
    });
  } else {
    for (const node of sourceBlocks) {
      const line = node.position?.start?.line;
      blocks.push({ node, line: line === undefined ? undefined : line - lineOffset });
    }
  }

  return blocks.map(({ node, line }, i) => {
    const attributes = node.attributes || {};
    return {
      key: attributes.use || undefined,
      password: attributes.password || undefined,
      resolvedFrom: attributes.password ? "inline" : undefined,
      name: attributes.name || undefined,
      context: attributes.name || contexts[i],
      description: attributes.description || undefined,
      type: "block",
      line,
      id: attributes.id || undefined,
    };
  });
};

/**
 * The blocks of each file as last read, by its path: a page whose text has
 * not changed is not parsed again. Hosts that clear the report on every
 * render (the cloud editor's preview) then pay for the changed pages only.
 */
const blocksByFile = new Map<
  string,
  { markdown: string; source: string; blocks: Block[] }
>();

const blocksOf = (absolute: string, markdown: string, source: string): Block[] => {
  if (!mayProtect(markdown) && !mayProtect(source)) {
    blocksByFile.delete(absolute);
    return [];
  }
  const known = blocksByFile.get(absolute);
  if (known && known.markdown === markdown && known.source === source) {
    return known.blocks;
  }
  const blocks = collectBlocks(markdown, source);
  blocksByFile.set(absolute, { markdown, source, blocks });
  return blocks;
};

const fromReference = (
  reference: ProtectReference,
  base: Omit<CollectedPassword, "key" | "password" | "description">,
): CollectedPassword => {
  const { use, password, name, description } = readProtectReference(reference);
  return {
    ...base,
    key: use,
    password,
    name,
    context: name,
    resolvedFrom: password ? "inline" : undefined,
    description,
  };
};

const walkSections = (
  sections: HyperbookSection[],
  pages: HyperbookPage[],
  out: CollectedPassword[],
  sectionHref?: string,
): void => {
  for (const page of pages) {
    if (!page.protect) continue;
    // A section's index.md is also one of its pages. It is already reported as
    // the section, so reporting it again would double every protected section.
    if (sectionHref && page.href === sectionHref) continue;
    out.push(
      fromReference(page.protect, {
        type: "page",
        href: page.href,
        file: page.path?.relative,
        inherited: page.protectInherited,
      }),
    );
  }

  for (const section of sections) {
    if (section.protect) {
      out.push(
        fromReference(section.protect, {
          type: "section",
          href: section.href,
          file: section.pages.find((p) => p.href === section.href)?.path
            ?.relative,
          inherited: section.protectInherited,
        }),
      );
    }
    walkSections(section.sections, section.pages, out, section.href);
  }
};

const cache = new Map<string, Promise<PasswordReport>>();

/**
 * Drops the memoised report. The dev server calls this on every change,
 * because a newly added `:::protect` block anywhere changes what a
 * `::passwordlist` on an unrelated page should show.
 */
export const clearCollectedPasswords = (root?: string) => {
  if (root) cache.delete(root);
  else cache.clear();
};

/**
 * Finds every password a book uses: the registry, `protect` frontmatter on
 * pages and sections, and `:::protect` blocks.
 *
 * Shared by `hyperbook passwords` and the `::passwordlist` directive, so the
 * two can never disagree about what a book contains. Memoised per root because
 * a book with `::passwordlist` on several pages would otherwise re-scan every
 * file for each of them.
 */
export const collectPasswords = (
  root: string,
  { reload = false }: { reload?: boolean } = {},
): Promise<PasswordReport> => {
  if (reload) cache.delete(root);
  const cached = cache.get(root);
  if (cached) return cached;

  const report = collect(root);
  cache.set(root, report);
  return report;
};

const collect = async (root: string): Promise<PasswordReport> => {
  const config = await vfile.getJson(root).catch(() => undefined);
  const entries: CollectedPassword[] = [];

  const { sections, pages, glossary } =
    await hyperbookFs.getPagesAndSections(root);
  walkSections(sections, pages, entries);
  walkSections([], glossary, entries);

  const pageMetadata = new Map<
    string,
    { pageName: string; sectionPath: string[]; navigationIndex: number }
  >();
  let navigationIndex = 0;
  const indexNavigation = (
    level: HyperbookSection[],
    levelPages: HyperbookPage[],
    ancestors: string[] = [],
  ) => {
    for (const page of hyperbookFs.getPageList(level, levelPages)) {
      if (!page.href || pageMetadata.has(page.href)) continue;
      const findPath = (
        sections: HyperbookSection[],
        path: string[],
      ): string[] | undefined => {
        for (const section of sections) {
          if (section.pages.some((candidate) => candidate.href === page.href)) {
            return [...path, section.name];
          }
          const nested = findPath(section.sections, [...path, section.name]);
          if (nested) return nested;
        }
      };
      pageMetadata.set(page.href, {
        pageName: page.name,
        sectionPath: findPath(level, ancestors) || ancestors,
        navigationIndex: navigationIndex++,
      });
    }
  };
  indexNavigation(sections, pages);
  for (const page of glossary) {
    if (page.href) {
      pageMetadata.set(page.href, {
        pageName: page.name,
        sectionPath: [],
        navigationIndex: navigationIndex++,
      });
    }
  }

  // listForFolder is overloaded per folder, so the two calls stay separate.
  const files = [
    ...(await vfile.listForFolder(root, "book")),
    ...(await vfile.listForFolder(root, "glossary")),
  ];
  for (const file of files) {
    const source = await fs
      .readFile(file.path.absolute, "utf8")
      .catch(() => file.markdown.content);
    // Copies: the report is filled in below, and the blocks are kept.
    for (const block of blocksOf(file.path.absolute, file.markdown.content, source)) {
      entries.push({
        ...block,
        href: file.path.href || undefined,
        file: file.path.relative,
      });
    }
  }

  for (const entry of entries) {
    const metadata = entry.href ? pageMetadata.get(entry.href) : undefined;
    if (metadata) Object.assign(entry, metadata);
  }

  const referenced = entries
    .map((e) => e.key)
    .filter((k): k is string => Boolean(k));

  const registry = withReferencedKeys(
    await getPasswords(root, config, { reload: true }),
    referenced,
  );

  // Fill in referenced keys, then add the registry itself so keys nothing uses
  // still show up in the listing.
  for (const entry of entries) {
    if (!entry.key) continue;
    const known = registry.passwords[entry.key];
    if (known?.value) {
      entry.password = known.value;
      entry.resolvedFrom = registry.sources[entry.key] || "file";
      entry.name = entry.name ?? known.name;
      entry.description = entry.description ?? known.description;
    } else {
      entry.password = undefined;
      entry.resolvedFrom = undefined;
    }
  }

  const referencedSet = new Set(referenced);
  for (const [key, value] of Object.entries(registry.passwords)) {
    const entry = value as RegistryEntry;
    entries.push({
      key,
      password: entry.value,
      resolvedFrom: registry.sources[key] || "file",
      name: entry.name,
      description: entry.description,
      type: "registry",
    });
  }

  const missing = entries.filter((e) => e.key && !e.password);

  const unused = Object.keys(registry.passwords).filter(
    (key) => !referencedSet.has(key),
  );

  // Two keys with the same value are usually a copy-paste slip: rotating one
  // silently leaves the other open.
  const byValue = new Map<string, string[]>();
  for (const [key, value] of Object.entries(registry.passwords)) {
    const secret = (value as RegistryEntry).value;
    if (!secret) continue;
    byValue.set(secret, [...(byValue.get(secret) || []), key]);
  }
  const duplicates = [...byValue.values()].filter((keys) => keys.length > 1);

  return {
    entries,
    missing,
    unused,
    duplicates,
    registryFile: registry.file,
  };
};
