import path from "path";
import { cp } from "fs/promises";

async function postbuild() {
  const markdownAssets = path.join(
    ...["./node_modules", "@hyperbook", "markdown", "dist", "assets"],
  );
  const distAssets = path.join(...["./dist", "assets"]);
  await cp(markdownAssets, distAssets, { recursive: true });

  const distLocales = path.join(...["./dist", "locales"]);
  const markdownLocales = path.join(
    ...["./node_modules", "@hyperbook", "markdown", "dist", "locales"],
  );
  await cp(markdownLocales, distLocales, { recursive: true });
}
postbuild();
