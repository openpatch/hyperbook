import {
  HyperlibraryJson,
  Hyperproject,
  Language,
  Link,
} from "@hyperbook/types";
import path from "path";
import * as hyperbook from "./hyperbook";
import * as hyperlibrary from "./hyperlibrary";

export const get = async (
  root: string,
  libraryEntry?: HyperlibraryJson["library"][0]
): Promise<Hyperproject> => {
  if (libraryEntry?.src) {
    root = path.join(root, libraryEntry.src);
  }
  const hyperbookJson = await hyperbook.getJson(root).catch(() => null);
  if (hyperbookJson) {
    return {
      type: "book",
      src: root,
      basePath: libraryEntry?.basePath ?? hyperbookJson.basePath,
      name: libraryEntry?.name ?? hyperbookJson.name,
      icon: libraryEntry?.icon,
    };
  }

  const hyperlibraryJson = await hyperlibrary.getJson(root).catch(() => null);
  if (hyperlibraryJson) {
    return {
      type: "library",
      src: root,
      basePath: libraryEntry?.basePath ?? hyperlibraryJson.basePath,
      name: libraryEntry?.name ?? hyperlibraryJson.name,
      projects: await Promise.all(
        hyperlibraryJson.library.map((p) =>
          get(root, {
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

  throw Error(`Missing book or library for path ${root}`);
};

export const getName = (project: Hyperproject, language?: Language) => {
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
      throw Error(
        `You need to provide a name for language ${language} in ${project.src}`
      );
    }
  }
  return label;
};

type GetLinkOptions = {
  href?: {
    useSrc?: true;
    append?: string[];
    prepend?: string[];
    relative?: string;
    protocol?: string;
  };
};

export const getLink = async (
  project: Hyperproject,
  language: Language = "en",
  options: GetLinkOptions = {}
): Promise<Link> => {
  const label = getName(project, language);

  if (project.type === "library") {
    return {
      label,
      links: await Promise.all(
        project.projects.map((p) => getLink(p, language, options))
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
        href = href.slice(1);
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
