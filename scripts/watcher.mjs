import chokidar from "chokidar";
import chalk from "chalk";
import { exec } from "child_process";

const log = console.log.bind(console);

const ignorePackages = [];
const watcher = chokidar.watch(
  [
    "packages/**/*.ts",
    "packages/**/*.tsx",
    "packages/**/*.css",
    "templates/**/*.ts",
    "templates/**/*.tsx",
  ],
  {
    ignored: [
      "packages/*/dist/**/*.ts",
      "packages/*/dist/**/*.tsx",
      "packages/*/dist/**/*.css",
      "node_modules",
    ],
    depth: 3,
    persistent: true,
    usePolling: true,
    interval: 500,
  }
);

const localeWatcher = chokidar.watch(["packages/*/src/locales.vocab/*.json"], {
  persistent: true,
  usePolling: true,
  interval: 500,
});

log(chalk.yellow.bold("Watching all files... 👀"));

localeWatcher.on("change", async (filePath) => {
  const splitPath = filePath.split("/");
  const location = `${splitPath[0]}/${splitPath[1]}/`;
  const fileName = splitPath[1];

  if (ignorePackages.includes(fileName)) {
    return;
  }

  log(chalk.yellow(`Changes detected in ${fileName}`));
  exec("pnpm build:locales", { cwd: location }, (err, stdout, stderr) => {
    if (!err || err === null) {
      log(`locales ${chalk.green("success")} - ${splitPath[1]}`);
    } else {
      log(err, stdout, stderr);
    }
  });
});

watcher.on("change", async (filePath) => {
  const splitPath = filePath.split("/");
  const location = `${splitPath[0]}/${splitPath[1]}/`;
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
