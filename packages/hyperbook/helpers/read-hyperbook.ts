import chalk from "chalk";
import fs from "fs";
import path from "path";

export async function readHyperbook(): Promise<{
  template?: string;
  basePath?: string;
}> {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(process.cwd(), "hyperbook.json"), (err, data) => {
      if (err) {
        console.log(
          chalk.red(
            "Could not find 'hyperbook.json'. Make sure you are in the right directory."
          )
        );
        reject();
      } else {
        const j = JSON.parse(data.toString());
        resolve(j as any);
      }
    });
  });
}
