import path from "path";
import matter from "gray-matter";
import fs from "fs/promises";
import fsD from "fs";
import { HyperbookFrontmatter } from "@hyperbook/types";
//@ts-ignore
import handlebars from "handlebars/dist/cjs/handlebars";
import yaml from "yaml";

handlebars.registerHelper("times", (n: number, block: any) => {
  let accum = "";
  for (let i = 0; i < n; ++i) accum += block.fn(i);
  return accum;
});

export type VFile = {
  root: string;
  folder: "archives" | "glossary" | "book" | "public" | "snippets";
  path: {
    directory: string;
    relative: string;
    absolute: string;
    href: string | null;
  };
  name: string;
  extension: string;
};

export type VDirectory = {
  root: string;
  folder: "archives" | "glossary" | "book" | "public" | "snippets";
  name: string;
  path: {
    relative: string;
    absolute: string;
  };
  files: VFile[];
  index?: VFile;
  directories: VDirectory[];
};

const folders = ["archives", "glossary", "book", "public", "snippets"] as const;

export function getHref(vfile: {
  path: { relative: string; directory: string };
  folder: VFile["folder"];
  name: VFile["name"];
  extension: VFile["extension"];
}): VFile["path"]["href"] {
  switch (vfile.folder) {
    case "book": {
      let href = "/";
      if (vfile.path.directory) {
        href = path.join(href, vfile.path.directory);
      }
      if (vfile.name !== "index") {
        href = path.join(href, vfile.name);
      }
      return href.trim();
    }
    case "snippets": {
      return null;
    }
    case "glossary": {
      let href = "/glossary";
      if (vfile.path.directory) {
        href = path.join(href, vfile.path.directory);
      }
      if (vfile.name !== "index") {
        href = path.join(href, vfile.name);
      }
      return href.trim();
    }
    case "public": {
      return "/" + vfile.path.relative;
    }
    case "archives": {
      return "/archives/" + vfile.path.directory + ".zip";
    }
  }
}

export async function getDirectory(
  root: string,
  folder: VFile["folder"]
): Promise<VDirectory> {
  async function getTree(directory: VDirectory): Promise<VDirectory> {
    const files = await fs
      .readdir(path.join(directory.path.absolute))
      .catch(() => []);
    for (const file of files) {
      const stat = await fs.stat(path.join(directory.path.absolute, file));
      if (stat.isDirectory()) {
        const { name } = path.parse(file);
        const d: VDirectory = {
          name,
          root,
          folder,
          directories: [],
          files: [],
          path: {
            absolute: path.join(directory.path.absolute, file),
            relative: path.join(directory.path.relative, file),
          },
        };
        directory.directories.push(await getTree(d));
      } else {
        const { ext, name } = path.parse(file);
        let vfile: VFile = {
          folder: folder as VFile["folder"],
          path: {
            directory: directory.path.relative,
            absolute: path.join(directory.path.absolute, file),
            relative: path.join(directory.path.relative, file),
            href: "",
          },
          name,
          root,
          extension: ext,
        };
        vfile.path.href = getHref(vfile);
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
      absolute: path.join(root, folder),
    },
    name: "",
    folder: folder,
    directories: [],
    files: [],
  });
}

export const flatDirectory = async ({
  directories,
  files,
  index,
}: VDirectory): Promise<VFile[]> => {
  const allFiles: VFile[] = [...files];
  if (index) {
    allFiles.push(index);
  }

  for (const directory of directories) {
    const dirFiles = await flatDirectory(directory);
    allFiles.push(...dirFiles);
  }

  return allFiles;
};

export async function listForFolder(
  root: string,
  folder: VFile["folder"]
): Promise<VFile[]> {
  const directory = await getDirectory(root, folder);
  return flatDirectory(directory);
}

export const list = async (root: string): Promise<VFile[]> => {
  return Promise.all(
    folders.flatMap((folder) => listForFolder(root, folder))
  ).then((f) => f.flat());
};

export const get = async (
  root: string,
  folder: VFile["folder"] | null,
  href: string
): Promise<VFile | undefined> => {
  if (folder === null) {
    const files = await list(root);
    return files.find((f) => f.path.href === href);
  }
  const files = await listForFolder(root, folder);
  return files.find((f) => f.path.href === href);
};

export const getByAbsolutePath = async (
  root: string,
  folder: VFile["folder"] | null,
  absolute: string
) => {
  if (folder === null) {
    const files = await list(root);
    return files.find((f) => f.path.absolute === absolute);
  }
  const files = await listForFolder(root, folder);
  return files.find((f) => f.path.absolute === absolute);
};

export const extractLines = (
  content: string,
  lines?: string,
  ellipsis?: string
): string => {
  if (!lines || typeof lines !== "string") {
    return content;
  }
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
  let extractedLines: string[] = [];
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

  return extractedLines.join("\n");
};

export const getMarkdown = async (
  file: VFile
): Promise<{ content: string; data: HyperbookFrontmatter }> => {
  if (file.folder !== "book" && file.folder !== "glossary") {
    throw Error(
      `Unsupported file location. Only files from book and glossary are supported for reading their markdown content.`
    );
  }

  handlebars.registerHelper(
    "file",
    (src: string, lines?: string, ellipsis?: string) => {
      if (!src) {
        throw Error("file needs a path to a file");
      }
      const content = fsD.readFileSync(path.join(file.root, src), "utf8");
      return extractLines(content, lines, ellipsis);
    }
  );

  let markdown = "";
  if (file.extension === ".yml") {
    const j = await fs
      .readFile(file.path.absolute)
      .then((f) => yaml.parse(f.toString()));
    if (!j.template) {
      throw Error(
        `Yaml files need a template. You need to define a template property in your yaml file: ${file.path.absolute}`
      );
    }
    const templateSource = await fs.readFile(
      path.join(file.root, "templates", j.template + ".md.hbs")
    );
    const template = handlebars.compile(templateSource.toString());
    markdown = template(j);
  } else if (file.extension === ".json") {
    const j = await fs
      .readFile(file.path.absolute)
      .then((f) => JSON.parse(f.toString()));
    if (!j.template) {
      throw Error(
        `JSON files need a template. You need to define a template property in your json file: ${file.path.absolute}`
      );
    }
    const templateSource = await fs.readFile(
      path.join(file.root, "templates", j.template + ".md.hbs")
    );
    const template = handlebars.compile(templateSource.toString());
    markdown = template(j);
  } else if (file.extension === ".md") {
    markdown = await fs.readFile(file.path.absolute).then((f) => f.toString());
  } else {
    throw Error(
      `Unsupported file extension. Only .md, .yml and .json files are supported.`
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
