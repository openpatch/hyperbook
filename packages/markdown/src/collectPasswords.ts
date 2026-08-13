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

const collectBlocks = (
  markdown: string,
  file: string,
  href: string | undefined,
): CollectedPassword[] => {
  const found: CollectedPassword[] = [];
  const tree = parser.parse(markdown) as Root;
  parser.runSync(tree);

  visit(tree, (node: any) => {
    if (node.type !== "containerDirective" || node.name !== "protect") return;
    const attributes = node.attributes || {};
    found.push({
      key: attributes.use || undefined,
      password: attributes.password || undefined,
      resolvedFrom: attributes.password ? "inline" : undefined,
      description: attributes.description || undefined,
      type: "block",
      href,
      file,
      line: node.position?.start?.line,
      id: attributes.id || undefined,
    });
  });

  return found;
};

const fromReference = (
  reference: ProtectReference,
  base: Omit<CollectedPassword, "key" | "password" | "description">,
): CollectedPassword => {
  const { use, password, description } = readProtectReference(reference);
  return {
    ...base,
    key: use,
    password,
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

  // listForFolder is overloaded per folder, so the two calls stay separate.
  const files = [
    ...(await vfile.listForFolder(root, "book")),
    ...(await vfile.listForFolder(root, "glossary")),
  ];
  for (const file of files) {
    entries.push(
      ...collectBlocks(
        file.markdown.content,
        file.path.relative,
        file.path.href || undefined,
      ),
    );
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
