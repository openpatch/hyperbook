import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import chalk from "chalk";
import handlebars from "handlebars";
import {
  HyperbookFrontmatter,
  HyperbookJson,
  Hyperproject,
  HyperlibraryJson,
  Language,
  Link,
  Navigation,
  HyperbookPage,
  HyperbookSection,
  Glossary,
} from "@hyperbook/types";
import { findUp } from "find-up";

const listFiles = async (
  root: string,
  dir: string = "",
  absolute: boolean = true
): Promise<string[]> => {
  const files = await fs.readdir(path.join(root, dir)).catch(() => []);
  return Promise.all(
    files.flatMap(async (file) => {
      const stat = await fs.stat(path.join(root, dir, file));
      if (stat.isDirectory()) {
        return listFiles(root, path.join(dir, file), absolute);
      } else if (file.endsWith(".md")) {
        if (absolute) {
          return [path.join(root, dir, file)];
        } else {
          return [path.join(dir, file)];
        }
      }
      return [];
    })
  ).then((f) => f.flat());
};

export const readBook = async (root: string, absolute: boolean = true) => {
  return listFiles(path.join(root, "book"), "", absolute);
};

export const readGlossary = async (root: string, absolute: boolean = true) => {
  return listFiles(path.join(root, "glossary"), "", absolute);
};

export const makeGlossary = async (root: string): Promise<Glossary> => {
  const files = await readGlossary(root);
  const glossary: Glossary = {};

  for (const file of files) {
    const { content, data } = await readFile(file);
    let name = path.basename(file, ".md");
    if (data.name) {
      name = data.name;
    } else {
      console.log(
        `\n${chalk.yellow(
          `warn  `
        )}- Glossary page ${file} does not specify a name. Defaulting to the filename ${name}.`
      );
    }

    const letter = name[0].toUpperCase();
    if (!glossary[letter]) {
      glossary[letter] = [];
    }

    const relativePath = path
      .relative(root, file)
      .replace(/\.md$/, "")
      .split("/");

    glossary[letter].push({
      name,
      href: "/" + relativePath.join("/"),
    });
  }

  return glossary;
};

export const listPagesForTerm = async (
  root: string,
  term: string
): Promise<HyperbookPage[]> => {
  const files = await readBook(root);

  const pages: HyperbookPage[] = [];

  for (const file of files) {
    const { content, data } = await readFile(file);
    const r = new RegExp(`:t\\[.*\\]\\{#${term}(\..*)?\\}|:t\\[${term}\\]`);
    const m = content.match(r);

    if (m && !data.hide && data.name) {
      const relativePath = path
        .relative(path.join(root, "book"), file)
        .replace(/\.md$/, "")
        .split("/");
      const isIndex = relativePath[relativePath.length - 1] === "index";
      if (isIndex) {
        relativePath.pop();
      }
      pages.push({
        ...data,
        href: "/" + relativePath.join("/"),
      });
    }
  }

  return pages;
};

export const readFile = async (file: string) => {
  const source = await fs
    .readFile(file)
    .catch(() =>
      fs
        .readFile(file + ".md")
        .catch(() => fs.readFile(path.join(file, "index.md")))
    );

  const { content, data } = matter(source);

  return { content, data: data as HyperbookFrontmatter };
};

export const resolveSnippets = async (root: string, content: string) => {
  const reg =
    /((:+)snippet{#(?<snippet>[a-zA-Z0-9-]+)(?<vars>( +(?<var>[a-zA-Z]+)=(?<value>\d+|false|true|".*"))*) *})/g;
  const varReg = /(?<var>[a-zA-Z]+)=(?<value>\d+|false|true|".*")/;
  const snippets = [...content.matchAll(reg)];

  for (const snippet of snippets) {
    const dots = snippet[2];
    const snippetId = snippet[3];
    const snippetFile = await fs.readFile(
      path.join(root, "snippets", snippetId + ".md.hbs"),
      { encoding: "utf8" }
    );
    const template = handlebars.compile(snippetFile);
    handlebars.registerHelper("times", (n, block) => {
      let accum = "";
      for (let i = 0; i < n; ++i) accum += block.fn(i);
      return accum;
    });
    const vars = {};
    for (const m of snippet[4].split(" ")) {
      const r = varReg.exec(m);
      if (r) {
        if (r[2].startsWith('"') && r[2].endsWith('"')) {
          vars[r[1]] = r[2].slice(1, -1);
        } else if (r[2] === "false") {
          vars[r[1]] = false;
        } else if (r[2] === "true") {
          vars[r[1]] = true;
        } else {
          vars[r[1]] = Number(r[2]);
        }
      }
    }
    if (dots.length > 1) {
      const r = `${snippet[0]}([\\s\\S]*?)${dots}`;
      const m = content.match(new RegExp(r, "m"));
      if (m) {
        vars["content"] = m[1];
        content = content.replace(m[0], template(vars));
      }
    } else {
      content = content.replace(snippet[0], template(vars));
    }
  }

  return content;
};

export const readHyperbook = async (root: string) => {
  return fs
    .readFile(path.join(root, "hyperbook.json"))
    .then((f) => f.toString())
    .then(JSON.parse) as Promise<HyperbookJson>;
};

export const readHyperlibrary = async (root: string) => {
  return fs
    .readFile(path.join(root, "hyperlibrary.json"))
    .then((f) => f.toString())
    .then(JSON.parse) as Promise<HyperlibraryJson>;
};

export const findHyperbook = async (file: string): Promise<HyperbookJson> => {
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

export const findHyperbookRoot = async (file: string): Promise<string> => {
  return findUp("hyperbook.json", {
    cwd: file,
  } as any).then((f) => {
    if (!f) {
      throw new Error("Could not find hyperbook.json");
    }
    return path.parse(f).dir;
  });
};

export const readProject = async (
  root: string,
  libraryEntry?: HyperlibraryJson["library"][0]
): Promise<Hyperproject> => {
  if (libraryEntry?.src) {
    root = path.join(root, libraryEntry.src);
  }
  const hyperbookJson = await readHyperbook(root).catch(() => null);
  if (hyperbookJson) {
    return {
      type: "book",
      src: root,
      basePath: libraryEntry?.basePath ?? hyperbookJson.basePath,
      name: libraryEntry?.name ?? hyperbookJson.name,
      icon: libraryEntry?.icon,
    };
  }

  const hyperlibraryJson = await readHyperlibrary(root).catch(() => null);
  if (hyperlibraryJson) {
    return {
      type: "library",
      src: root,
      basePath: libraryEntry?.basePath ?? hyperlibraryJson.basePath,
      name: libraryEntry?.name ?? hyperlibraryJson.name,
      projects: await Promise.all(
        hyperlibraryJson.library.map((p) =>
          readProject(root, {
            ...p,
            basePath: path.join(
              libraryEntry?.basePath ?? hyperlibraryJson.basePath ?? "",
              p.basePath
            ),
          })
        )
      ),
      icon: libraryEntry?.icon,
    };
  }

  console.log(
    `${chalk.red("Error")} - Missing book or library for path ${root}.`
  );

  throw Error(`Missing book or library for path ${root}`);
};

export const getProjectName = (project: Hyperproject, language?: Language) => {
  let label = "";
  if (typeof project.name === "string") {
    label = project.name;
  } else {
    if (language) {
      label = project.name[language] || "";
    } else {
      label = Object.values(project.name)[0];
    }
    if (!label) {
      console.log(
        chalk.red(
          `You need to provide a name for language ${language} in ${project.src}`
        )
      );
      throw Error("");
    }
  }
  return label;
};

type MakeLinkForHyperprojectOptions = {
  href?: {
    useSrc?: true;
    append?: string[];
    prepend?: string[];
    relative?: string;
    protocol?: string;
  };
};

export const makeLinkForHyperproject = async (
  project: Hyperproject,
  language: Language = "en",
  options: MakeLinkForHyperprojectOptions = {}
): Promise<Link> => {
  const label = getProjectName(project, language);

  if (project.type === "library") {
    return {
      label,
      links: await Promise.all(
        project.projects.map((p) =>
          makeLinkForHyperproject(p, language, options)
        )
      ),
      icon: project.icon,
    };
  } else {
    let href = project.basePath ?? "/";
    if (!href.startsWith("/")) {
      href = "/" + href;
    }

    if (options.href?.useSrc) {
      href = project.src;
    }
    if (options.href?.relative) {
      href = path.relative(options.href.relative, href);
    }
    if (options.href?.prepend) {
      href = path.join(...options.href.prepend, href);
    }
    if (options.href?.append) {
      href = path.join(href, ...options.href.append);
    }
    if (options.href?.protocol) {
      if (href.startsWith("/")) {
        href = href.slice(0, -1);
      }
      href = options.href.protocol + href;
    }

    if (href.length > 1 && href.endsWith("/")) {
      href = href.slice(0, -1);
    }

    return {
      label,
      href,
      icon: project.icon,
    };
  }
};

export const makeNavigationForHyperbook = async (
  root: string,
  currPath: string = "/"
): Promise<Navigation> => {
  const hyperbook = await readHyperbook(root);

  const getSectionsAndPages = async function (
    dirPath: string,
    pageList: HyperbookPage[] = []
  ) {
    const files = await fs.readdir(dirPath);
    let arrayOfPages: HyperbookPage[] = [];
    let arrayOfSections: HyperbookSection[] = [];

    for (const file of files) {
      let p = path.join(dirPath, file);
      let repo: string | null = null;
      if (typeof hyperbook.repo === "string") {
        if (hyperbook.repo.includes("%path%")) {
          repo = hyperbook.repo.replace("%path%", path.relative(root, p));
        } else {
          repo = hyperbook.repo + "/" + path.relative(root, p);
        }
      } else if (hyperbook.repo) {
        if (hyperbook.repo.url.includes("%path%")) {
          repo = hyperbook.repo.url.replace("%path%", path.relative(root, p));
        } else {
          repo = hyperbook.repo.url + "/" + path.relative(root, p);
        }
      }

      const stat = await fs.stat(p);

      if (stat.isDirectory()) {
        const { pages, sections } = await getSectionsAndPages(p, pageList);
        const { content, data } = await readFile(p);
        const section: HyperbookSection = {
          ...data,
          href: "/" + path.relative(path.join(root, "book"), p),
          isEmpty: content.trim() === "",
          pages,
          sections,
        };
        if (repo) {
          section.repo = repo + "/index.md";
        }

        arrayOfSections.push(section);
      } else {
        const { data } = await readFile(p);
        if (p.endsWith(".md")) {
          p = p.substring(0, p.length - 3);
          if (path.relative(path.join(root, "book"), p) === "index") {
            p = p.substring(0, p.length - 5);
          }
          if (!p.endsWith("index")) {
            const page: HyperbookPage = {
              ...data,
              href: "/" + path.relative(path.join(root, "book"), p),
            };
            if (repo) {
              page.repo = repo;
            }

            arrayOfPages.push(page);
          }
        }
      }
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

  const { sections, pages } = await getSectionsAndPages(
    path.join(root, "book")
  );

  let pageList = getPageList(sections, pages);

  let i = pageList.findIndex((p) => p.href === currPath);
  const current = pageList[i] || null;

  pageList = pageList.filter(
    (p) => (!p.isEmpty || p.href === currPath) && !p.hide
  );
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
