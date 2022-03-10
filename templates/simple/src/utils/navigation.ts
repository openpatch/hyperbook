import fs from "fs";
import matter from "gray-matter";
import path from "path";
import hyperbook from "../../hyperbook.json";

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
  isEmpty?: boolean;
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
    source = fs.readFileSync(path.join(filePath, "index") + ".md");
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

  const pageList = getPageList(sections, pages);

  const i = pageList.findIndex((p) => p.href === currPath);

  const next = pageList[i + 1] || null;
  const previous = pageList[i - 1] || null;
  const current = pageList[i] || null;

  return {
    next,
    current,
    previous,
    sections,
    pages,
  };
};
