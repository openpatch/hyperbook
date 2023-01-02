import path from "path";
import fs from "fs/promises";
import {
  HyperbookJson,
  HyperbookPage,
  HyperbookSection,
  Navigation,
} from "@hyperbook/types";
import { findUp } from "find-up";
import { vfile } from ".";
import { VDirectory, VFile } from "./vfile";

export const getJson = async (root: string): Promise<HyperbookJson> => {
  return fs
    .readFile(path.join(root, "hyperbook.json"))
    .then((f) => f.toString())
    .then(JSON.parse);
};

export const find = async (file: string): Promise<HyperbookJson> => {
  return findUp("hyperbook.json", {
    cwd: file,
  } as any)
    .then((f) => {
      if (!f) {
        throw new Error("Could not find hyperbook.json");
      }
      return fs.readFile(f);
    })
    .then((f) => JSON.parse(f.toString()));
};

export const findRoot = async (file: string): Promise<string> => {
  return findUp("hyperbook.json", {
    cwd: file,
  } as any).then((f) => {
    if (!f) {
      throw new Error("Could not find hyperbook.json");
    }
    return path.parse(f).dir;
  });
};

export const makeRepoLink = (
  repoTemplate: HyperbookJson["repo"],
  vfile: VFile
): string | null => {
  const relative = path.join(vfile.folder, vfile.path.relative);
  if (typeof repoTemplate === "string") {
    if (repoTemplate.includes("%path%")) {
      return repoTemplate.replace("%path%", relative);
    } else {
      return repoTemplate + "/" + relative;
    }
  } else if (repoTemplate) {
    if (repoTemplate.url.includes("%path%")) {
      return repoTemplate.url.replace("%path%", relative);
    } else {
      return repoTemplate + "/" + relative;
    }
  }
  return null;
};

export const getNavigation = async (
  root: string,
  currentFile?: VFile
): Promise<Navigation> => {
  const hyperbook = await getJson(root);
  const directory = await vfile.getDirectory(root, "book");

  const getSectionsAndPages = async function ({
    directories,
    files,
    index,
  }: VDirectory): Promise<{
    pages: HyperbookPage[];
    sections: HyperbookSection[];
  }> {
    let arrayOfPages: HyperbookPage[] = [];
    let arrayOfSections: HyperbookSection[] = [];

    for (const directory of directories) {
      let section: HyperbookSection = {
        name: directory.name,
        pages: [],
        sections: [],
        isEmpty: true,
      };
      if (directory.index) {
        const markdown = await vfile.getMarkdown(directory.index);
        section = {
          ...markdown.data,
          isEmpty: markdown.content.trim() === "",
          repo: makeRepoLink(hyperbook.repo, directory.index) ?? undefined,
          href: directory.index.path.href ?? undefined,
          pages: [],
          sections: [],
        };
      }
      const { pages, sections } = await getSectionsAndPages(directory);
      arrayOfSections.push({
        ...section,
        pages,
        sections,
      });
    }

    if (index && index.path.href == "/") {
      files.push(index);
    }

    for (const file of files) {
      const { data } = await vfile.getMarkdown(file);
      arrayOfPages.push({
        ...data,
        repo: makeRepoLink(hyperbook.repo, file) ?? undefined,
        href: file.path.href ?? undefined,
      });
    }

    arrayOfPages = arrayOfPages.sort((a, b) => (a.name > b.name ? 1 : -1));
    arrayOfPages = arrayOfPages.sort((a, b) => {
      const iIndex = a.index !== undefined ? a.index : 9999;
      const eIndex = b.index !== undefined ? b.index : 9999;
      return iIndex - eIndex;
    });
    arrayOfSections = arrayOfSections.sort((a, b) =>
      a.name > b.name ? 1 : -1
    );
    arrayOfSections = arrayOfSections.sort((a, b) => {
      const iIndex = a.index !== undefined ? a.index : 9999;
      const eIndex = b.index !== undefined ? b.index : 9999;
      return iIndex - eIndex;
    });

    return { pages: arrayOfPages, sections: arrayOfSections };
  };

  const getPageList = (
    sections: HyperbookSection[],
    pages: HyperbookPage[]
  ): HyperbookPage[] => {
    let pageList = [...pages];

    for (const section of sections) {
      pageList = [
        ...pageList,
        section,
        ...getPageList(section.sections, section.pages),
      ];
    }

    return pageList;
  };

  const { sections, pages } = await getSectionsAndPages(directory);

  let pageList = getPageList(sections, pages);
  let current: HyperbookPage | null = null;
  let next: HyperbookPage | null = null;
  let previous: HyperbookPage | null = null;

  if (currentFile) {
    let i = pageList.findIndex((p) => p.href === currentFile.path.href);
    current = pageList[i] || null;

    pageList = pageList.filter(
      (p) => (!p.isEmpty || p.href === currentFile.path.href) && !p.hide
    );
    i = pageList.findIndex((p) => p.href === currentFile.path.href);

    next = pageList[i + 1] || null;
    previous = pageList[i - 1] || null;
  }

  return {
    next,
    current,
    previous,
    sections,
    pages,
  };
};
