import path from "path";
import matter from "gray-matter";
import fs from "fs/promises";
import fsD from "fs";
import { Glossary, HyperbookFrontmatter } from "@hyperbook/types";
import yaml from "yaml";
import { handlebars, registerHelpers } from "./handlebars";

export type VFileBase = {
  root: string;
  folder: string;
  path: {
    directory: string;
    relative: string;
    absolute: string;
    href: string | null;
  };
  name: string;
  extension: string;
};

export type VFileArchive = VFileBase & {
  folder: "archives";
  extension: ".zip";
};

export const pageExtensions = [".md", ".md.hbs", ".json", ".yml"] as const;

export type VFileGlossary = VFileBase & {
  folder: "glossary";
  extension: (typeof pageExtensions)[number];
  markdown: {
    content: string;
    data: HyperbookFrontmatter;
  };
  references: VFileBook[];
};

export type VFileBook = VFileBase & {
  folder: "book";
  extension: (typeof pageExtensions)[number];
  markdown: {
    content: string;
    data: HyperbookFrontmatter;
  };
};

export type VFilePublic = VFileBase & {
  folder: "public";
  extension: string;
};

export type VFileSnippet = VFileBase & {
  folder: "snippets";
  extension: ".hbs";
};

export type VFile =
  | VFileArchive
  | VFileGlossary
  | VFileBook
  | VFilePublic
  | VFileSnippet;

export type VDirectoryBase = {
  root: string;
  name: string;
  path: {
    relative: string;
    absolute: string;
  };
};

export type VDirectoryArchive = VDirectoryBase & {
  folder: "archives";
  files: VFileArchive[];
};

export type VDirectoryGlossary = VDirectoryBase & {
  folder: "glossary";
  files: VFileGlossary[];
  directories: VDirectoryGlossary[];
};

export type VDirectoryBook = VDirectoryBase & {
  folder: "book";
  files: VFileBook[];
  directories: VDirectoryBook[];
  index?: VFileBook;
};

export type VDirectoryPublic = VDirectoryBase & {
  folder: "public";
  files: VFilePublic[];
  directories: VDirectoryPublic[];
};

export type VDirectorySnippets = VDirectoryBase & {
  folder: "snippets";
  files: VFileSnippet[];
};

export type VDirectory =
  | VDirectoryArchive
  | VDirectoryGlossary
  | VDirectoryBook
  | VDirectoryPublic
  | VDirectorySnippets;

const folders = ["archives", "glossary", "book", "public", "snippets"] as const;

async function getDirectoryArchives(root: string): Promise<VDirectoryArchive> {
  const vfiles: VFileArchive[] = [];

  try {
    const files = await fs.readdir(path.join(root, "archives"));
    for (const file of files) {
      const stat = await fs.stat(path.join(root, "archives", file));
      if (stat.isDirectory()) {
        const { name } = path.parse(file);
        const vfile: VFileArchive = {
          folder: "archives",
          name,
          path: {
            href: "/archives/" + name + ".zip",
            absolute: path.join(root, "archives", file),
            relative: file,
            directory: "",
          },
          extension: ".zip",
          root,
        };
        vfiles.push(vfile);
      }
    }
  } catch {}

  return {
    name: "",
    root,
    path: {
      relative: "archives",
      absolute: path.join(root, "archives"),
    },
    folder: "archives",
    files: vfiles,
  };
}

async function getDirectoryBook(root: string): Promise<VDirectoryBook> {
  async function getTree(directory: VDirectoryBook): Promise<VDirectoryBook> {
    const files = await fs
      .readdir(path.join(directory.path.absolute))
      .catch(() => []);
    for (const file of files) {
      const stat = await fs.stat(path.join(directory.path.absolute, file));
      if (stat.isDirectory()) {
        const { name } = path.parse(file);
        const d: VDirectoryBook = {
          name,
          root,
          folder: "book",
          directories: [],
          files: [],
          path: {
            absolute: path.join(directory.path.absolute, file),
            relative: path.join(directory.path.relative, file),
          },
        };
        directory.directories.push(await getTree(d));
      } else {
        let { ext, name } = path.parse(file);
        if (ext == ".hbs" && file.endsWith(".md.hbs")) {
          ext = ".md.hbs";
          name = name.slice(0, name.length - 3);
        }
        if (!pageExtensions.includes(ext as any)) {
          continue;
        }
        let vfileBase: VFileBase = {
          folder: "book",
          path: {
            directory: directory.path.relative,
            absolute: path.join(directory.path.absolute, file),
            relative: path.join(directory.path.relative, file),
            href: "",
          },
          extension: ext as (typeof pageExtensions)[number],
          name,
          root,
        };
        let vfile: VFileBook = {
          ...vfileBase,
          folder: "book",
          extension: ext as (typeof pageExtensions)[number],
          markdown: await getMarkdown(vfileBase),
        };

        let href = "/";
        if (vfile.path.directory) {
          href = path.join(href, vfile.path.directory);
        }
        if (vfile.name !== "index") {
          href = path.join(href, vfile.name);
        }
        vfile.path.href = href.trim();
        if (name === "index") {
          directory.index = vfile;
        } else {
          directory.files.push(vfile);
        }
      }
    }
    return directory;
  }
  return getTree({
    root,
    path: {
      relative: "",
      absolute: path.join(root, "book"),
    },
    name: "",
    folder: "book",
    directories: [],
    files: [],
  });
}

async function getDirectoryGlossary(root: string): Promise<VDirectoryGlossary> {
  const bookFiles: VFileBook[] = (await listForFolder(root, "book")) as any;
  async function getTree(
    directory: VDirectoryGlossary
  ): Promise<VDirectoryGlossary> {
    const files = await fs
      .readdir(path.join(directory.path.absolute))
      .catch(() => []);
    for (const file of files) {
      const stat = await fs.stat(path.join(directory.path.absolute, file));
      if (stat.isDirectory()) {
        const { name } = path.parse(file);
        const d: VDirectoryGlossary = {
          name,
          root,
          folder: "glossary",
          directories: [],
          files: [],
          path: {
            absolute: path.join(directory.path.absolute, file),
            relative: path.join(directory.path.relative, file),
          },
        };
        directory.directories.push(await getTree(d));
      } else {
        let { ext, name } = path.parse(file);
        if (ext == ".hbs" && file.endsWith(".md.hbs")) {
          ext = ".md.hbs";
          name = name.slice(0, name.length - 3);
        }
        if (!pageExtensions.includes(ext as any)) {
          continue;
        }
        let vfilebase: VFileBase = {
          folder: "glossary",
          path: {
            directory: directory.path.relative,
            absolute: path.join(directory.path.absolute, file),
            relative: path.join(directory.path.relative, file),
            href: "",
          },
          name,
          root,
          extension: ext as (typeof pageExtensions)[number],
        };
        const references: VFileBook[] = [];
        for (const bookFile of bookFiles) {
          const content = bookFile.markdown.content;
          const r = new RegExp(
            `:t\\[.*\\]\\{#${name}(\..*)?\\}|:t\\[${name}\\]`
          );
          const m = content.match(r);
          if (m && !bookFile.markdown.data.hide) {
            references.push(bookFile);
          }
        }
        let vfile: VFileGlossary = {
          ...vfilebase,
          folder: "glossary",
          extension: ext as (typeof pageExtensions)[number],
          markdown: await getMarkdown(vfilebase),
          references,
        };
        let href = "/glossary";
        if (vfile.path.directory) {
          href = path.join(href, vfile.path.directory);
        }
        if (vfile.name !== "index") {
          href = path.join(href, vfile.name);
        }
        vfile.path.href = href.trim();
        directory.files.push(vfile);
      }
    }
    return directory;
  }
  return getTree({
    root,
    path: {
      relative: "",
      absolute: path.join(root, "glossary"),
    },
    name: "",
    folder: "glossary",
    directories: [],
    files: [],
  });
}

async function getDirectoryPublic(root: string): Promise<VDirectoryPublic> {
  async function getTree(
    directory: VDirectoryPublic
  ): Promise<VDirectoryPublic> {
    const files = await fs
      .readdir(path.join(directory.path.absolute))
      .catch(() => []);
    for (const file of files) {
      const stat = await fs.stat(path.join(directory.path.absolute, file));
      if (stat.isDirectory()) {
        const { name } = path.parse(file);
        const d: VDirectoryPublic = {
          name,
          root,
          folder: "public",
          directories: [],
          files: [],
          path: {
            absolute: path.join(directory.path.absolute, file),
            relative: path.join(directory.path.relative, file),
          },
        };
        directory.directories.push(await getTree(d));
      } else {
        let { ext, name } = path.parse(file);
        let vfile: VFilePublic = {
          folder: "public",
          path: {
            directory: directory.path.relative,
            absolute: path.join(directory.path.absolute, file),
            relative: path.join(directory.path.relative, file),
            href: "/" + path.join(directory.path.relative, file),
          },
          name,
          root,
          extension: ext,
        };
        directory.files.push(vfile);
      }
    }
    return directory;
  }
  return getTree({
    root,
    path: {
      relative: "",
      absolute: path.join(root, "public"),
    },
    name: "",
    folder: "public",
    directories: [],
    files: [],
  });
}

export async function getGlossary(root: string): Promise<Glossary> {
  const files: VFileGlossary[] = await listForFolder(root, "glossary");
  const glossary: Glossary = {};

  for (const file of files) {
    if (!file.path.href) {
      continue;
    }

    const { data } = file.markdown;
    const name = data.name ?? file.name;

    const letter = name[0].toUpperCase();
    if (!glossary[letter]) {
      glossary[letter] = [];
    }

    glossary[letter].push({
      name,
      href: file.path.href,
    });
  }

  return glossary;
}

export async function get(
  root: string,
  folder: "book",
  path: string,
  by?: keyof VFile["path"]
): Promise<VFileBook>;
export async function get(
  root: string,
  folder: "snippets",
  path: string,
  by?: keyof VFile["path"]
): Promise<VFileSnippet>;
export async function get(
  root: string,
  folder: "archives",
  path: string,
  by?: keyof VFile["path"]
): Promise<VFileArchive>;
export async function get(
  root: string,
  folder: "public",
  path: string,
  by?: keyof VFile["path"]
): Promise<VFilePublic>;
export async function get(
  root: string,
  folder: "glossary",
  path: string,
  by?: keyof VFile["path"]
): Promise<VFileGlossary>;
export async function get(
  root: string,
  folder: VDirectory["folder"],
  path: string,
  by: keyof VFile["path"] = "href"
): Promise<VFile> {
  const files = await listForFolder(root, folder as any);
  const file = files.find((f) => f.path[by] == path);
  if (!file) {
    throw new Error(`File for ${path} not found!`);
  }
  return file;
}

export async function getDirectory(
  root: string,
  folder: "book"
): Promise<VDirectoryBook>;
export async function getDirectory(
  root: string,
  folder: "archives"
): Promise<VDirectoryArchive>;
export async function getDirectory(
  root: string,
  folder: "glossary"
): Promise<VDirectoryGlossary>;
export async function getDirectory(
  root: string,
  folder: "public"
): Promise<VDirectoryPublic>;
export async function getDirectory(
  root: string,
  folder: "snippets"
): Promise<VDirectorySnippets>;
export async function getDirectory(
  root: string,
  folder: VDirectory["folder"]
): Promise<VDirectory> {
  const cache = path.join(root, `vdirectory.${folder}.json`);
  if (fsD.existsSync(cache)) {
    return JSON.parse(fsD.readFileSync(cache, "utf8"));
  }
  switch (folder) {
    case "glossary": {
      const dir = await getDirectoryGlossary(root);
      fsD.writeFileSync(cache, JSON.stringify(dir));
      return dir;
    }
    case "archives": {
      const dir = await getDirectoryArchives(root);
      fsD.writeFileSync(cache, JSON.stringify(dir));
      return dir;
    }
    case "public": {
      const dir = await getDirectoryPublic(root);
      fsD.writeFileSync(cache, JSON.stringify(dir));
      return dir;
    }
    default: {
      const dir = await getDirectoryBook(root);
      fsD.writeFileSync(cache, JSON.stringify(dir));
      return dir;
    }
  }
}

const flatDirectory = async (directory: VDirectory): Promise<VFile[]> => {
  let allFiles: VFile[] = [];
  if (directory.files) {
    allFiles.push(...directory.files);
    if ("index" in directory && directory.index) {
      allFiles.push(directory.index);
    }
  }

  if ("directories" in directory && directory.directories) {
    for (const d of directory.directories) {
      const dirFiles = await flatDirectory(d);
      allFiles.push(...dirFiles);
    }
  }

  return allFiles;
};

export async function listForFolder(
  root: string,
  folder: "book"
): Promise<VFileBook[]>;
export async function listForFolder(
  root: string,
  folder: "snippets"
): Promise<VFileSnippet[]>;
export async function listForFolder(
  root: string,
  folder: "archives"
): Promise<VFileArchive[]>;
export async function listForFolder(
  root: string,
  folder: "public"
): Promise<VFilePublic[]>;
export async function listForFolder(
  root: string,
  folder: "glossary"
): Promise<VFileGlossary[]>;
export async function listForFolder(
  root: string,
  folder: VDirectory["folder"]
): Promise<VFile[]> {
  const directory = await getDirectory(root, folder as any);
  return flatDirectory(directory);
}

export const list = async (root: string): Promise<VFile[]> => {
  const cache = path.join(root, "vfiles.json");
  if (fsD.existsSync(cache)) {
    return JSON.parse(fsD.readFileSync(cache, "utf8"));
  }
  const vfiles = await Promise.all(
    folders.flatMap((folder) => listForFolder(root, folder as any))
  ).then((f) => f.flat());
  fsD.writeFileSync(cache, JSON.stringify(vfiles));
  return vfiles;
};

export const clean = async (root: string): Promise<void> => {
  const cache = path.join(root, "vfiles.json");
  if (fsD.existsSync(cache)) {
    fsD.rmSync(cache);
  }
  folders.forEach((folder) => {
    const cache = path.join(root, `vdirectory.${folder}.json`);
    if (fsD.existsSync(cache)) {
      fsD.rmSync(cache);
    }
  });
};

export const extractLines = (
  content: string,
  lines?: string,
  ellipsis?: string
): string => {
  if (!lines || typeof lines !== "string") {
    return content;
  }

  let extractedLines: string[] = [];
  if (!lines.startsWith("reg:")) {
    const lineNumbers: number[] = [];
    for (const line of lines.split(",")) {
      if (line.includes("-")) {
        const [start, end] = line.split("-");
        for (let i = Number(start); i <= Number(end); i++) {
          lineNumbers.push(i);
        }
      } else {
        lineNumbers.push(Number(line));
      }
    }

    const contentLines = content.split("\n");
    let lastLineNumber = 0;
    for (const lineNumber of lineNumbers) {
      if (lineNumber - lastLineNumber > 1 && ellipsis) {
        extractedLines.push(ellipsis);
      }
      extractedLines.push(contentLines[lineNumber - 1]);
      lastLineNumber = lineNumber;
    }
    if (lastLineNumber < contentLines.length - 1 && ellipsis) {
      extractedLines.push(ellipsis);
    }
  } else {
    const contentLines = content.split("\n");
    const reg = new RegExp(lines.slice(4));
    extractedLines = contentLines.filter((c) => !reg.test(c));
  }

  return extractedLines.join("\n");
};

export const getMarkdown = async (
  file: VFileBase
): Promise<{ content: string; data: HyperbookFrontmatter }> => {
  if (file.folder !== "book" && file.folder !== "glossary") {
    throw Error(
      `Unsupported file location. Only files from book and glossary are supported for reading their markdown content.`
    );
  }

  registerHelpers(handlebars, { file });

  let markdown = "";
  if (file.extension === ".yml") {
    const j = await fs
      .readFile(file.path.absolute)
      .then((f) => yaml.parse(f.toString()));
    if (!j.template) {
      console.log(
        `Yaml files need a template. You need to define a template property in your yaml file: ${file.path.absolute}`
      );
    } else {
      const templateSource = await fs.readFile(
        path.join(file.root, "templates", j.template + ".md.hbs")
      );
      const template = handlebars.compile(templateSource.toString());
      markdown = template(j);
    }
  } else if (file.extension === ".json") {
    const j = await fs
      .readFile(file.path.absolute)
      .then((f) => JSON.parse(f.toString()))
      .catch(() => ({}));
    if (!j.template) {
      console.log(
        `JSON files need a template. You need to define a template property in your json file: ${file.path.absolute}`
      );
    } else {
      const templateSource = await fs.readFile(
        path.join(file.root, "templates", j.template + ".md.hbs")
      );
      const template = handlebars.compile(templateSource.toString());
      markdown = template(j);
    }
  } else if (file.extension === ".md") {
    markdown = await fs.readFile(file.path.absolute).then((f) => f.toString());
  } else if (file.extension === ".md.hbs") {
    const templateString = await fs
      .readFile(file.path.absolute)
      .then((f) => f.toString());
    const template = handlebars.compile(templateString);
    markdown = template();
  } else {
    console.log(
      `Unsupported file extension ${file.extension}. Only .md, .yml, .json and .md.hbs files are supported.`
    );
  }
  let { content, data } = matter(markdown);
  // apply Snippets
  const reg =
    /((:+)snippet{#(?<snippet>[a-zA-Z0-9-]+)(?<vars>( +(?<var>[a-zA-Z]+)=(?<value>\d+|false|true|".*"))*) *})/g;
  const varReg = /(?<var>[a-zA-Z]+)=(?<value>\d+|false|true|".*")/;
  const snippets = [...content.matchAll(reg)];

  for (const snippet of snippets) {
    const dots = snippet[2];
    const snippetId = snippet[3];
    const snippetFile = await fs.readFile(
      path.join(file.root, "snippets", snippetId + ".md.hbs"),
      { encoding: "utf8" }
    );
    const template = handlebars.compile(snippetFile);
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
    if (dots.length > 2) {
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

  return { content, data: { ...data } as HyperbookFrontmatter };
};
