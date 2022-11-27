import fs from "fs";
import path from "path";
import chalk from "chalk";
import { Hyperproject } from "@hyperbook/types";

export function isSetup(root: string, rootProject?: Hyperproject): boolean {
  const folder =
    "Could not find .hyperbook folder. Be sure to run `hyperbook setup`.";
  try {
    const s = fs.statSync(path.join(root, ".hyperbook"));
    if (!s.isDirectory()) {
      throw Error();
    }
  } catch (e) {
    console.log(
      chalk.red(
        `Could not find .hyperbook folder at ${folder}. Be sure to run \`hyperbook setup\`.`
      )
    );
    return false;
  }

  if (process.env.HYPERBOOK_LOCAL_DEV) {
    return true;
  }

  const nextBin = path.join(
    rootProject?.src || root,
    ".hyperbook",
    "node_modules",
    ".bin",
    "next"
  );
  try {
    fs.statSync(nextBin);
  } catch (e) {
    console.log(
      chalk.red(
        `Could not find next binary at ${nextBin}. Be sure to run \`hyperbook setup\`.`
      )
    );
    return false;
  }

  return true;
}
