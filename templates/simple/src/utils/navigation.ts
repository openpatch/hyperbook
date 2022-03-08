import fs from "fs";
import matter from "gray-matter";
import path from "path";
import { getHyperbook, Hyperbook } from "./hyperbook";

export type Page = {
  name: string;
  description?: string;
  keywords?: string[];
  repo?: string;
  hide?: boolean;
  index?: number;
  href: string;
};

export type Section = Page & {
  pages: Page[]; // md-files
  sections: Section[]; // folders
};

export type Navigation = {
  next: Page | null;
  previous: Page | null;
  current: Page;
  pages: Page[];
  sections: Section[];
};

const readFile = (filePath: string) => {
  let source: Buffer;
  filePath = path.join(process.cwd(), filePath);
  try {
    source = fs.readFileSync(filePath);
  } catch (e) {
    source = fs.readFileSync(path.join(filePath, "index") + ".md");
  }

  const { content, data } = matter(source);

  return { content, data: data as Page };
};

const getSectionsAndPages = async function (
  dirPath: string,
  hyperbook: Hyperbook,
  pageList: Page[] = []
) {
  const files = fs.readdirSync(path.join(process.cwd(), dirPath));
  let arrayOfPages: Page[] = [];
  let arrayOfSections: Section[] = [];

  for (const file of files) {
    let p = path.join(dirPath, file);
    const { data } = readFile(p);
    if (fs.statSync(p).isDirectory()) {
      const {
        pages,
        sections,
        pageList: pL,
      } = await getSectionsAndPages(p, hyperbook, pageList);
      const section = {
        ...data,
        href: path.relative("book", p),
        pages,
        sections,
      };

      arrayOfSections.push(section);

      pageList = [...pageList, ...pL];
    } else {
      let repo: string | null;
      if (hyperbook.repo) {
        repo = hyperbook.repo + "/" + p;
      }

      if (p.endsWith("index.md")) {
        p = p.substring(0, p.length - 8);
      }
      if (p.endsWith(".md")) {
        p = p.substring(0, p.length - 3);
      }
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

  arrayOfPages = arrayOfPages.sort((a, b) => a.index - b.index);

  pageList = [...arrayOfPages, ...pageList];
  arrayOfSections = arrayOfSections.sort((a, b) => a.index - b.index);

  return { pages: arrayOfPages, sections: arrayOfSections, pageList };
};

export const getNavigation = async (
  currPath: string = "/"
): Promise<Navigation> => {
  const hyperbook = await getHyperbook();
  const { sections, pages, pageList } = await getSectionsAndPages(
    "book",
    hyperbook
  );

  const i = pageList.findIndex((p) => p.href === currPath);

  const next = pageList[i + 1] || null;
  const previous = pageList[i - 1] || null;
  const current = pageList[i];

  return {
    next,
    current,
    previous,
    sections,
    pages,
  };
};
