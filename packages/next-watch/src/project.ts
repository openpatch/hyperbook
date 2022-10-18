import { HyperbookJson, HyperlibraryJson, Link } from "@hyperbook/types";
import fs from "fs/promises";
import chalk from "chalk";
import path from "path";

export type Book = {
  type: "book";
  src: string;
  basePath?: string;
  href: string;
  icon?: string;
  name: string;
  template?: string;
};

export type Library = {
  type: "library";
  name: string;
  basePath?: string;
  icon?: string;
  src: string;
  projects: Project[];
};

export type Project = Book | Library;

export function makeLink(project: Project): Link {
  if (project.type === "library") {
    return {
      label: project.name,
      links: project.projects.map(makeLink),
      icon: project.icon,
    };
  } else {
    return {
      label: project.name,
      href: project.href,
      icon: project.icon,
    };
  }
}

export async function collect(
  root: string,
  basePath?: string,
  label?: string,
  icon?: string
): Promise<Project> {
  const hyperbookJson = await fs
    .readFile(path.join(root, "hyperbook.json"))
    .then((data) => JSON.parse(data.toString()) as HyperbookJson)
    .catch((e) => {
      if (e instanceof SyntaxError) {
        console.error(e);
      }
      return null;
    });

  if (hyperbookJson) {
    let href = basePath ?? hyperbookJson.basePath ?? "/";
    if (!href.startsWith("/")) {
      href = "/" + href;
    }

    if (href.length > 1 && href.endsWith("/")) {
      href = href.slice(0, -1);
    }
    return {
      type: "book",
      src: root,
      href,
      basePath: basePath ?? hyperbookJson.basePath,
      template: hyperbookJson.template,
      name: label ?? hyperbookJson.name,
      icon,
    };
  }

  const hyperlibraryJson = await fs
    .readFile(path.join(root, "hyperlibrary.json"))
    .then((data) => JSON.parse(data.toString()) as HyperlibraryJson)
    .catch((e) => {
      if (e instanceof SyntaxError) {
        console.error(e);
      }
      return null;
    });

  if (hyperlibraryJson) {
    const projects = await Promise.all(
      hyperlibraryJson.books.map(
        async ({ src, basePath: localBasePath, name, icon }) => {
          return collect(
            path.join(root, src),
            path.join(
              basePath ?? hyperlibraryJson.basePath ?? "",
              localBasePath
            ),
            name,
            icon
          );
        }
      )
    );

    return {
      type: "library",
      name: label ?? hyperlibraryJson.name,
      basePath: basePath ?? hyperlibraryJson.basePath,
      src: root,
      icon,
      projects,
    };
  }

  console.log(
    `${chalk.red("Error")} - Missing book or library for path ${root}.`
  );

  throw Error(`Missing book or library for path ${root}`);
}
