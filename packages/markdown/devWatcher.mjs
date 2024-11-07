import chokidar from "chokidar";
import chalk from "chalk";
import liveServer from "live-server";
import { execSync } from "child_process";
import path from "path";

const log = console.log.bind(console);

const watcher = chokidar.watch(
  ["dev.mjs", "devBuild.mjs", "src/**/*", "dev.md", "assets/**/*"],
  {
    interval: 600,
    usePolling: true,
    persistent: true,
    depth: 6,
  },
);

log(chalk.yellow.bold("Watching markdown... 👀"));

function rebuild(filePath) {
  const splitPath = filePath.split(path.sep);
  execSync(`pnpm build`, (err, stdout, stderr) => {
    if (!err || err === null) {
      log(`build ${chalk.green("success")} - ${splitPath[1]}`);
    } else {
      log(err, stdout, stderr);
    }
  });
  execSync(`pnpm dev:build`, (err, stdout, stderr) => {
    if (!err || err === null) {
      log(`build ${chalk.green("success")} - ${splitPath[1]}`);
    } else {
      log(err, stdout, stderr);
    }
  });
}

watcher.on("change", async (filePath) => {
  log(chalk.yellow(`Changes detected in ${filePath}`));
  rebuild(filePath);
});
liveServer.start({
  wait: 5000,
  open: false,
});
