import chokidar from "chokidar";
import chalk from "chalk";
import { exec } from "child_process";
import path from "path";

const log = console.log.bind(console);

const ignorePackages = [];
const watcher = chokidar.watch(
  [
    "packages/**/*.ts",
    "packages/**/*.tsx",
    "packages/**/*.css",
    "packages/markdown/assets/**/*",
    "platforms/**/*.ts",
    "platforms/**/*.css",
    "platforms/**/*.tsx",
  ],
  {
    ignored: ["packages/**/dist/**"],
    depth: 6,
    followSymlinks: false,
    persistent: true,
    usePolling: true,
    interval: 500,
  },
);

log(chalk.yellow.bold("Watching all files... 👀"));

watcher.on("change", async (filePath) => {
  const splitPath = filePath.split(path.sep);
  const location = `${splitPath[0]}${path.sep}${splitPath[1]}${path.sep}`;
  const fileName = splitPath[1];

  if (ignorePackages.includes(fileName)) {
    return;
  }

  log(chalk.yellow(`Changes detected in ${fileName}`));
  exec(`pnpm build`, { cwd: location }, (err, stdout, stderr) => {
    if (!err || err === null) {
      log(`build ${chalk.green("success")} - ${splitPath[1]}`);
    } else {
      log(err, stdout, stderr);
    }
  });
});
