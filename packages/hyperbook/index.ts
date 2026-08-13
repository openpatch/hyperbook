#!/usr/bin/env node

import chalk from "chalk";
import { Command, InvalidArgumentError } from "commander";
import checkForUpdate from "update-check";
import { runBuildProject } from "./build";
import { runCheck } from "./check";
import { runDev } from "./dev";
import { getPkgManager } from "./helpers/get-pkg-manager";
import { hyperproject } from "@hyperbook/fs";
import { runNew } from "./new";
import { reportError } from "./helpers/report-error";
import {
  runPasswordsCheck,
  runPasswordsInit,
  runPasswordsList,
} from "./passwords";
import packageJson from "./package.json";

const program = new Command();

/**
 * Kicked off before the command runs so the network round trip overlaps with
 * the build. Must be declared before `parseAsync` below: commander invokes the
 * first `preAction` hook synchronously, so a `const` declared after the parse
 * call would still be in its temporal dead zone when the hook reads it.
 */
const update = checkForUpdate(packageJson).catch(() => null);

program
  .name(packageJson.name)
  .version(packageJson.version)
  .hook("preAction", async () => {
    await notifyUpdate();
  });

program
  .command("new")
  .description("create a new hyperbook")
  .arguments("<book-directory>")
  .usage(`${chalk.green("<book-directory>")}`)
  .action(async (name: string) => {
    await runNew({
      programName: program.name(),
      bookPath: name,
    }).catch(() => process.exit(1));
  });

program.command("setup").action(async () => {
  console.log(`${chalk.yellow("hyperbook setup is deprecated.")}`);
});

program
  .command("dev")
  .description("start the development server for a hyperbook")
  .option("-p, --port <number>", "set a specific port", (value) => {
    const port = Number.parseInt(value, 10);
    if (Number.isNaN(port) || port < 1 || port > 65535) {
      throw new InvalidArgumentError("Expected a port between 1 and 65535.");
    }
    return port;
  })
  .action(async (options) => {
    await runDev({
      port: options.port,
    }).catch((e) => {
      reportError(e);
      process.exit(1);
    });
  });

/** Loads the project in the working directory, reporting failures readably. */
const withProject = async () =>
  hyperproject.get(process.cwd()).catch((e) => {
    reportError(e);
    process.exit(1);
  });

program
  .command("build")
  .description("build a hyperbook")
  .action(async () => {
    const rootProject = await withProject();
    let name = hyperproject.getName(rootProject);
    console.log(
      `${chalk.blue(`[${name}]`)} Building Project: ${rootProject.src}.`,
    );
    await runBuildProject(rootProject, rootProject).catch((e) => {
      reportError(e);
      process.exit(1);
    });
  });

program
  .command("check")
  .description("verify that internal links and images resolve")
  .option("--strict", "exit non-zero on warnings as well as errors")
  .action(async (options) => {
    const ok = await runCheck(await withProject(), options).catch((e) => {
      reportError(e);
      process.exit(1);
    });
    if (!ok) process.exit(1);
  });

const passwords = program
  .command("passwords")
  .description("inspect the passwords a hyperbook uses");

passwords
  .command("list", { isDefault: true })
  .description("list every password and where it is used")
  .option("--json", "output as JSON")
  .option(
    "-t, --type <types>",
    "only show registry, section, page or block entries",
  )
  .option("-f, --filter <regex>", "only show entries matching a pattern")
  .action(async (options) => {
    await runPasswordsList(await withProject(), options).catch((e) => {
      reportError(e);
      process.exit(1);
    });
  });

passwords
  .command("init")
  .description("create or update the password registry file")
  .option("--file <path>", "write to a different registry file")
  .option("--generate", "fill empty entries with random passwords")
  .option("--force", "also replace entries that already have a value")
  .action(async (options) => {
    await runPasswordsInit(await withProject(), options).catch((e) => {
      reportError(e);
      process.exit(1);
    });
  });

passwords
  .command("check")
  .description("verify that every referenced password resolves")
  .option("--json", "output as JSON")
  .action(async (options) => {
    const ok = await runPasswordsCheck(await withProject(), options).catch(
      (e) => {
        reportError(e);
        process.exit(1);
      },
    );
    if (!ok) process.exit(1);
  });

program.parseAsync(process.argv);

async function notifyUpdate(): Promise<void> {
  try {
    const res = await update;
    if (res?.latest) {
      const pkgManager = getPkgManager();

      console.log();
      console.log(
        chalk.yellow.bold("A new version of `hyperbook` is available!"),
      );
      console.log(
        "You can update by running: " +
          chalk.cyan(
            pkgManager === "yarn"
              ? "yarn global add hyperbook"
              : `${pkgManager} install --global hyperbook`,
          ),
      );
      console.log();
    }
  } catch {
    // ignore error
  }
}
