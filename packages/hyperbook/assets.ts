import { hyperbook, vfile, getPasswords } from "@hyperbook/fs";
import { process as processMarkdown } from "@hyperbook/markdown";
import { Hyperproject } from "@hyperbook/types";
import { VFile } from "vfile";
import { makeBaseCtx } from "./build";
import { AssetManager } from "./helpers/assets";

/** Render expanded pages so snippets, templates and directive dependencies count. */
export async function projectDirectives(
  project: Hyperproject,
  rootProject = project,
): Promise<Set<string>> {
  const directives = new Set<string>();
  if (project.type === "library") {
    for (const book of project.projects) {
      for (const directive of await projectDirectives(book, rootProject))
        directives.add(directive);
    }
    return directives;
  }

  vfile.clean(project.src);
  const config = await hyperbook.getJson(project.src);
  const pages = await hyperbook.getPagesAndSections(project.src);
  const pageList = hyperbook.getPageList(pages.sections, pages.pages);
  const { passwords } = await getPasswords(project.src, config);
  const base = {
    ...makeBaseCtx(
      project.src,
      config,
      project.basePath || config.basePath,
      rootProject,
    ),
    passwords,
  };
  const files = [
    ...(await vfile.listForFolder(project.src, "book")),
    ...(await vfile.listForFolder(project.src, "glossary")),
  ];
  for (const file of files) {
    const navigation = {
      ...(await hyperbook.getNavigationForFile(pageList, file)),
      ...pages,
    };
    if (!navigation.current && file.markdown.data) {
      navigation.current = {
        name: file.markdown.data.name || file.name,
        path: file.path,
        href: file.path.href || undefined,
        scripts: file.markdown.data.scripts,
        styles: file.markdown.data.styles,
        lang: file.markdown.data.lang,
        layout: file.markdown.data.layout,
      };
    }
    const result = await processMarkdown(
      new VFile({ path: file.path.absolute, value: file.markdown.content }),
      { ...base, navigation },
    );
    for (const directive of Object.keys(result.data.directives || {}))
      directives.add(directive);
  }
  return directives;
}

export async function fetchAssets(
  project: Hyperproject | undefined,
  assets = new AssetManager(),
): Promise<void> {
  const directives = project
    ? await projectDirectives(project)
    : new Set(Object.keys((await assets.readManifest()).bundles));
  for (const directive of directives) await assets.ensure(directive);
  console.log(`[Assets] Assets ready. Cache: ${assets.cacheDir}`);
}
