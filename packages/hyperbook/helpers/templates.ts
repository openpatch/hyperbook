/* eslint-disable import/no-extraneous-dependencies */
import got from "got";
import tar from "tar";
import { Stream } from "stream";
import { promisify } from "util";
import chalk from "chalk";

const pipeline = promisify(Stream.pipeline);

export type RepoInfo = {
  username: string;
  name: string;
  branch: string;
  filePath: string;
  version: string;
};

export async function isUrlOk(url: string): Promise<boolean> {
  const res = await got.head(url).catch((e) => e);
  return res.statusCode === 200;
}

export function hasRepo({
  username,
  name,
  branch,
  filePath,
}: RepoInfo): Promise<boolean> {
  const contentsUrl = `https://api.github.com/repos/${username}/${name}/contents`;
  const packagePath = `${filePath ? `/${filePath}` : ""}/package.json`;

  return isUrlOk(contentsUrl + packagePath + `?ref=${branch}`);
}

export async function getTemplatePackageJson(
  name: string
): Promise<{ version: string }> {
  return await got(
    `https://raw.githubusercontent.com/openpatch/hyperbook/main/templates/${name}/package.json`
  ).json<{ version: string }>();
}

export function hasTemplate(name: string): Promise<boolean> {
  return isUrlOk(
    `https://api.github.com/repos/openpatch/hyperbook/contents/templates/${encodeURIComponent(
      name
    )}/package.json`
  );
}

export function downloadAndExtractRepo(
  root: string,
  { username, name, branch, filePath }: RepoInfo
): Promise<void> {
  return pipeline(
    got.stream(
      `https://codeload.github.com/${username}/${name}/tar.gz/${branch}`
    ),
    tar.extract(
      { cwd: root, strip: filePath ? filePath.split("/").length + 1 : 1 },
      [`${name}-${branch}${filePath ? `/${filePath}` : ""}`]
    )
  );
}

export async function getTemplateInfo(templateName: string) {
  let repoInfo: RepoInfo | undefined;
  if (templateName) {
    const template = `https://github.com/openpatch/hyperbook/tree/main/templates/${templateName}`;
    let repoUrl: URL | undefined;

    try {
      repoUrl = new URL(template);
    } catch (error: any) {
      if (error.code !== "ERR_INVALID_URL") {
        console.error(error);
        process.exit(1);
      }
    }

    if (repoUrl) {
      if (repoUrl.origin !== "https://github.com") {
        console.error(
          `Invalid URL: ${chalk.red(
            `"${template}"`
          )}. Only GitHub repositories are supported. Please use a GitHub URL and try again.`
        );
        process.exit(1);
      }

      repoInfo = {
        version: (await getTemplatePackageJson(templateName)).version,
        name: "hyperbook",
        branch: "main",
        filePath: `templates/${templateName}`,
        username: "openpatch",
      };

      if (!repoInfo) {
        console.error(
          `Found invalid GitHub URL: ${chalk.red(
            `"${template}"`
          )}. Please fix the URL and try again.`
        );
        process.exit(1);
      }

      const found = await hasRepo(repoInfo);

      if (!found) {
        console.error(
          `Could not locate the repository for ${chalk.red(
            `"${template}"`
          )}. Please check that the repository exists and try again.`
        );
        process.exit(1);
      }
    } else if (template !== "__internal-testing-retry") {
      const found = await hasTemplate(template);

      if (!found) {
        console.error(
          `Could not locate an template named ${chalk.red(
            `"${template}"`
          )}. It could be due to the following:\n`,
          `1. Your spelling of template ${chalk.red(
            `"${template}"`
          )} might be incorrect.\n`,
          `2. You might not be connected to the internet.`
        );
        process.exit(1);
      }
    }
  }

  return repoInfo;
}
