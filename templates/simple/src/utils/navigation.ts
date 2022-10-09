import fs from "fs";
import matter from "gray-matter";
import path from "path";
import { getHyperbook } from "./hyperbook";

const hyperbook = getHyperbook();

export type Page = {
  name: string;
  description?: string;
  keywords?: string[];
  repo?: string;
  hide?: boolean;
  toc?: boolean;
  index?: number;
  isEmpty?: boolean;
  href: string;
};

export type Section = Omit<Page, "hide"> & {
  hide?: boolean;
  virtual?: boolean;
  expanded?: boolean;
  pages: Page[]; // md-files
  sections: Section[]; // folders
};

export type Navigation = {
  next: Page | null;
  previous: Page | null;
  current: Page | null;
  pages: Page[];
  sections: Section[];
};

export const readFile = (filePath: string) => {
  let source: Buffer;
  filePath = path.join(process.cwd(), filePath);
  try {
    source = fs.readFileSync(filePath);
  } catch (e) {
    try {
      source = fs.readFileSync(path.join(filePath, "index") + ".md");
    } catch (e) {
      source = new Buffer(`---\nname: ${path.basename(filePath)}\n---\n`);
      fs.writeFileSync(path.join(filePath, "index") + ".md", source);
    }
  }

  const { content, data } = matter(source);

  return { content, data: data as Page };
};

const getSectionsAndPages = async function (
  dirPath: string,
  pageList: Page[] = []
) {
  const files = fs.readdirSync(path.join(process.cwd(), dirPath));
  let arrayOfPages: Page[] = [];
  let arrayOfSections: Section[] = [];

  for (const file of files) {
    let p = path.join(dirPath, file);
    let repo: string | null;
    if (hyperbook.repo) {
      repo = hyperbook.repo + "/" + p;
    }

    if (fs.statSync(p).isDirectory()) {
      const { pages, sections } = await getSectionsAndPages(p, pageList);
      const { content, data } = readFile(p);
      const section = {
        ...data,
        href: "/" + path.relative("book", p),
        isEmpty: content.trim() === "",
        pages,
        sections,
      };
      if (repo) {
        section.repo = repo + "/index.md";
      }

      arrayOfSections.push(section);
    } else {
      const { data } = readFile(p);
      if (p.endsWith(".md")) {
        p = p.substring(0, p.length - 3);
        if (path.relative("book", p) === "index") {
          p = p.substring(0, p.length - 5);
        }
        if (!p.endsWith("index")) {
          const page: Page = {
            ...data,
            href: "/" + path.relative("book", p),
          };
          if (repo) {
            page.repo = repo;
          }

          arrayOfPages.push(page);
        }
      }
    }
  }

  arrayOfPages = arrayOfPages.sort((a, b) => a.index - b.index);
  arrayOfSections = arrayOfSections.sort((a, b) => a.index - b.index);

  return { pages: arrayOfPages, sections: arrayOfSections };
};

const getPageList = (sections: Section[], pages: Page[]): Page[] => {
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

export const getNavigation = async (
  currPath: string = "/"
): Promise<Navigation> => {
  const { sections, pages } = await getSectionsAndPages("book");

  let pageList = getPageList(sections, pages);

  let i = pageList.findIndex((p) => p.href === currPath);
  const current = pageList[i] || null;

  pageList = pageList.filter((p) => !p.isEmpty && !p.hide);
  i = pageList.findIndex((p) => p.href === currPath);

  const next = pageList[i + 1] || null;
  const previous = pageList[i - 1] || null;

  return {
    next,
    current,
    previous,
    sections,
    pages,
  };
};
