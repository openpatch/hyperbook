import {
  Language,
  LanguageString,
  HyperbookJson,
  HyperlibraryJson,
  Link,
} from "@hyperbook/types";
import fs from "fs/promises";
import chalk from "chalk";
import path from "path";

export type Book = {
  type: "book";
  src: string;
  basePath?: string;
  icon?: string;
  name: string | LanguageString;
  template?: string;
};

export type Library = {
  type: "library";
  name: string | LanguageString;
  basePath?: string;
  icon?: string;
  src: string;
  projects: Project[];
};

export type Project = Book | Library;

export function getProjectName(project: Project, language?: Language) {
  let label = "";
  if (typeof project.name === "string") {
    label = project.name;
  } else {
    if (language) {
      label = project.name[language];
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
}

export function makeLinks(project: Project, language: Language = "en"): Link {
  const label = getProjectName(project, language);

  if (project.type === "library") {
    return {
      label,
      links: project.projects.map((p) => makeLinks(p, language)),
      icon: project.icon,
    };
  } else {
    let href = project.basePath ?? "/";
    if (!href.startsWith("/")) {
      href = "/" + href;
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
}

export async function collect(
  root: string,
  basePath?: string,
  label?: string | LanguageString,
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
    return {
      type: "book",
      src: root,
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
          if (!localBasePath) {
            console.log(
              chalk.red(
                `Missing basePath for book ${name} in library ${path.join(
                  root,
                  "hyperlibrary.json"
                )}`
              )
            );
          }
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
