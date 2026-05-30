import path from "path";
import { cp, rm } from "fs/promises";

async function postbuild() {
  const markdownAssets = path.join(
    ...["./node_modules", "@hyperbook", "markdown", "dist", "assets"],
  );
  const distAssets = path.join(...["./dist", "assets"]);
  await cp(markdownAssets, distAssets, {
    recursive: true,
    filter: (src) => {
      // Exclude source module directories — only the bundled output belongs in dist.
      const rel = path.relative(markdownAssets, src);
      return !rel.startsWith("directive-pyide" + path.sep + "src") && rel !== "directive-pyide/src";
    },
  });

  const templates = path.join(
    ...["./node_modules", "create-hyperbook", "dist", "templates"],
  );
  const distTemplates = path.join(...["./dist", "templates"]);
  await cp(templates, distTemplates, { recursive: true });

  const distLocales = path.join(...["./dist", "locales"]);
  const markdownLocales = path.join(
    ...["./node_modules", "@hyperbook", "markdown", "dist", "locales"],
  );
  await cp(markdownLocales, distLocales, { recursive: true });

  const distLunrLanguages = path.join(...["./dist", "lunr-languages"]);
  const lunrLanguages = path.join(
    ...["./node_modules", "lunr-languages", "min"],
  );
  await cp(lunrLanguages, distLunrLanguages, { recursive: true });
}
postbuild();
