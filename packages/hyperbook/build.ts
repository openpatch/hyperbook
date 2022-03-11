import spawn from "cross-spawn";
import path from "path";
import fs from "fs";
import { isSetup } from "./helpers/is-setup";
import { readHyperbook } from "./helpers/read-hyperbook";

export async function runBuild(): Promise<void> {
  const setup = isSetup();
  if (!setup) {
    return;
  }
  const hyperbook = await readHyperbook();
  if (hyperbook?.basePath) {
    fs.writeFileSync(
      path.join(process.cwd(), ".hyperbook", "next.config.js"),
      `
module.exports = {
    basePath: '${hyperbook.basePath}',
    typescript: {
      ignoreBuildErrors: true,
    }
}
      `
    );
  }
  return new Promise((resolve, reject) => {
    const command = "npm";
    const args = ["run", "build"];
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: path.join(process.cwd(), ".hyperbook"),
      env: { ...process.env, ADBLOCK: "1", DISABLE_OPENCOLLECTIVE: "1" },
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject({ command: `${command} ${args.join(" ")}` });
        return;
      }
      // TODO copy out dir to root folder
      resolve();
    });
  });
}
