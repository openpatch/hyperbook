import fs from "fs";
import path from "path";
import chalk from "chalk";

export function isSetup(): boolean {
  try {
    const s = fs.statSync(path.join(process.cwd(), ".hyperbook"));
    if (!s.isDirectory()) {
      throw Error();
    }
  } catch (e) {
    console.log(
      chalk.red(
        "Could not find .hyperbook folder. Be sure to run `hyperbook setup`."
      )
    );
    return false;
  }

  try {
    fs.statSync(
      path.join(process.cwd(), ".hyperbook", "node_modules", ".bin", "next")
    );
  } catch (e) {
    console.log(
      chalk.red(
        "Could not find next binary in the .hyperbook folder. Be sure to run `hyperbook setup`."
      )
    );
    return false;
  }

  return true;
}
