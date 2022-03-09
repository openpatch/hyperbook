import rimraf from "rimraf";
import chalk from "chalk";
import retry from "async-retry";
import {
  downloadAndExtractRepo,
  getTemplateInfo,
  RepoInfo,
} from "./helpers/templates";
import { install } from "./helpers/install";
import { getOnline } from "./helpers/is-online";
import { makeDir } from "./helpers/make-dir";
import path from "path";
import { makeSymlink } from "./helpers/make-symlink";
import { readHyperbook } from "./helpers/read-hyperbook";

export class DownloadError extends Error {}

export async function runSetup(
  template?: string,
  repoInfo?: RepoInfo | undefined,
  root?: string
) {
  if (!root) {
    root = process.cwd();
  }

  if (!template) {
    const hyperbook = await readHyperbook();
    template = hyperbook.template;
  }

  if (!template) {
    template =
      "https://github.com/openpatch/hyperbook/tree/main/templates/simple";
  }

  if (!repoInfo) {
    repoInfo = await getTemplateInfo(template);
  }
  const nextRoot = path.join(root, ".hyperbook");
  console.log("Removing old template");
  rimraf.sync(nextRoot);
  await makeDir(nextRoot);

  const isOnline = await getOnline();
  /**
   * If an template repository is provided, clone it.
   */
  try {
    if (repoInfo) {
      const repoInfo2 = repoInfo;
      console.log(
        `Downloading files from repo ${chalk.cyan(
          template
        )}. This might take a moment.`
      );
      console.log();
      await retry(() => downloadAndExtractRepo(nextRoot, repoInfo2), {
        retries: 3,
      });
    }
  } catch (reason) {
    function isErrorLike(err: unknown): err is { message: string } {
      return (
        typeof err === "object" &&
        err !== null &&
        typeof (err as { message?: unknown }).message === "string"
      );
    }
    throw new DownloadError(isErrorLike(reason) ? reason.message : reason + "");
  }

  console.log("Installing packages. This might take a couple of minutes.");
  console.log();

  await install(nextRoot, null, { packageManager: "npm", isOnline });
  console.log();

  rimraf.sync(path.join(nextRoot, "book"));
  rimraf.sync(path.join(nextRoot, "public"));
  rimraf.sync(path.join(nextRoot, "glossary"));
  rimraf.sync(path.join(nextRoot, "hyperbook.json"));
  await makeSymlink(path.join(root, "book"), path.join(nextRoot, "book"));
  await makeSymlink(path.join(root, "public"), path.join(nextRoot, "public"));
  await makeSymlink(
    path.join(root, "glossary"),
    path.join(nextRoot, "glossary")
  );
  await makeSymlink(
    path.join(root, "hyperbook.json"),
    path.join(nextRoot, "hyperbook.json")
  );
}
