import { getFileSystemAdapter, getPathAdapter } from "./fs-adapter";
import {
  HyperbookJson,
  HyperbookPage,
  HyperbookSection,
  Navigation,
} from "@hyperbook/types";
import { findUp } from "find-up";
import { vfile } from ".";
import { VDirectoryBook, VFile } from "./vfile";

const fs = () => getFileSystemAdapter();
const path = () => getPathAdapter();

export const getJson = async (root: string): Promise<HyperbookJson> => {
  return fs()
    .readFile(path().join(root, "hyperbook.json"))
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
      return fs().readFile(f);
    })
    .then((f) => JSON.parse(f.toString()));
};

export const findRoot = async (file: string): Promise<string> => {
  return findUp("hyperbook.json", {
    cwd: file,
  } as any).then((f) => {
    if (!f) {
      console.log(file);
      throw new Error("Could not find hyperbook.json");
    }
    return path().parse(f).dir;
  });
};

export const makeRepoLink = (
  repoTemplate: HyperbookJson["repo"],
  vfile: VFile,
): string | null => {
  const relative = path().posix.join(
    vfile.folder.replaceAll(path().sep, "/"),
    vfile.path.relative.replaceAll(path().sep, "/"),
  );
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

export const getNavigationForFile = async (
  pageList: HyperbookPage[],
  currentFile?: VFile,
): Promise<Pick<Navigation, "current" | "next" | "previous">> => {
  let current: HyperbookPage | null = null;
  let next: HyperbookPage | null = null;
  let previous: HyperbookPage | null = null;

  if (currentFile) {
    let i = pageList.findIndex((p) => p.href === currentFile.path.href);
    current = pageList[i] || null;

    pageList = pageList.filter(
      (p) => (!p.isEmpty || p.href === currentFile.path.href) && !p.hide,
    );
    i = pageList.findIndex((p) => p.href === currentFile.path.href);

    if (current !== null && current.next !== undefined) {
      next =
        pageList.find((p) => {
          if (current?.next?.startsWith("/@/")) {
            return p.permaid === current.next.split("/@/")[1].trim();
          }
          return p.href === current?.next;
        }) || null;
    } else {
      next = pageList[i + 1] || null;
    }

    if (current !== null && current.prev !== undefined) {
      previous =
        pageList.find((p) => {
          if (current?.prev?.startsWith("/@/")) {
            return p.permaid === current.prev.split("/@/")[1].trim();
          }
          return p.href === current?.prev;
        }) || null;
    } else {
      previous = pageList[i - 1] || null;
    }
  }

  return {
    current,
    next,
    previous,
  };
};

export const getPagesAndSections = async (
  root: string,
): Promise<Pick<Navigation, "pages" | "sections" | "glossary">> => {
  const hyperbook = await getJson(root);
  const directory = await vfile.getDirectory(root, "book");
  const glossary = await vfile.listForFolder(root, "glossary");

  const getSectionsAndPages = async function ({
    directories,
    files,
    index,
  }: VDirectoryBook): Promise<{
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
          name: markdown.data?.name || directory.name,
          isEmpty: markdown.content.trim() === "",
          pages: [],
          sections: [],
        };
        const repo = makeRepoLink(hyperbook.repo, directory.index);
        if (repo) {
          section.repo = repo;
        }
        if (directory.index.path.href) {
          section.href = directory.index.path.href;
        }
        const { pages, sections } = await getSectionsAndPages(directory);

        arrayOfSections.push({
          ...section,
          pages,
          sections,
        });
      }
    }

    if (index && index.path.href == "/") {
      files.push(index);
    }

    for (const file of files) {
      const data = file.markdown.data;
      if (!data.name) {
        data.name = file.name;
      }
      const page: HyperbookPage = {
        ...data,
        path: file.path,
      };
      const repo = makeRepoLink(hyperbook.repo, file);
      if (repo) {
        page.repo = repo;
      }
      if (file.path.href) {
        page.href = file.path.href;
      }
      arrayOfPages.push(page);
    }

    arrayOfPages = arrayOfPages.sort((a, b) => (a.name > b.name ? 1 : -1));
    arrayOfPages = arrayOfPages.sort((a, b) => {
      const iIndex = a.index !== undefined ? a.index : 9999;
      const eIndex = b.index !== undefined ? b.index : 9999;
      return iIndex - eIndex;
    });
    arrayOfSections = arrayOfSections.sort((a, b) =>
      a.name > b.name ? 1 : -1,
    );
    arrayOfSections = arrayOfSections.sort((a, b) => {
      const iIndex = a.index !== undefined ? a.index : 9999;
      const eIndex = b.index !== undefined ? b.index : 9999;
      return iIndex - eIndex;
    });

    return {
      pages: arrayOfPages,
      sections: arrayOfSections,
    };
  };

  const { sections, pages } = await getSectionsAndPages(directory);

  return {
    sections,
    pages,
    glossary: glossary.map(
      (g) =>
        ({
          href: g.path.href,
          ...g.markdown.data,
          name: g.markdown.data?.name || g.name,
          repo: makeRepoLink(hyperbook.repo, g),
        }) as HyperbookPage,
    ),
  };
};

export const getPageList = (
  sections: HyperbookSection[],
  pages: HyperbookPage[],
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
