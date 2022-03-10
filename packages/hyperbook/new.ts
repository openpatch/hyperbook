import os from "os";
import chalk from "chalk";
import cpy from "cpy";
import path from "path";
import fs from "fs";
import prompts from "prompts";
import { isFolderEmpty } from "./helpers/is-folder-empty";
import { isWriteable } from "./helpers/is-writeable";
import { makeDir } from "./helpers/make-dir";
import { tryGitInit } from "./helpers/git";
import { getTemplateInfo } from "./helpers/templates";
import { runSetup } from "./setup";

export async function runNew({
  programName,
  bookPath,
  template,
}: {
  programName: string;
  bookPath: string;
  template: string;
}): Promise<void> {
  if (typeof bookPath === "string") {
    bookPath = bookPath.trim();
  }

  if (!bookPath) {
    const res = await prompts({
      type: "text",
      name: "path",
      message: "What is your book named?",
      initial: "my-book",
    });

    if (typeof res.path === "string") {
      bookPath = res.path.trim();
    }
  }

  if (!bookPath) {
    console.log();
    console.log("Please specify the book directory:");
    console.log(
      `  ${chalk.cyan(programName)} ${chalk.green("<book-directory>")}`
    );
    console.log();
    console.log("For example:");
    console.log(`  ${chalk.cyan(programName)} ${chalk.green("my-new-book")}`);
    console.log();
    console.log(
      `Run ${chalk.cyan(`${programName} --help`)} to see all options.`
    );
    process.exit(1);
  }

  let repoInfo = await getTemplateInfo(template);

  const root = path.resolve(bookPath);

  if (!(await isWriteable(path.dirname(root)))) {
    console.error(
      "The book path is not writable, please check folder permissions and try again."
    );
    console.error(
      "It is likely you do not have write permissions for this folder."
    );
    process.exit(1);
  }

  const bookName = path.basename(root);

  await makeDir(root);
  if (!isFolderEmpty(root, bookName)) {
    process.exit(1);
  }
  const originalDirectory = process.cwd();

  console.log(`Creating a new hyperbook in ${chalk.green(root)}.`);
  console.log();

  process.chdir(root);

  const { description } = await prompts({
    type: "text",
    name: "description",
    message: "What is your book about?",
    initial: "",
  });

  const { author } = await prompts({
    type: "text",
    name: "author",
    message: "Who is the author of the book?",
    initial: "",
  });

  const { authorUrl } = await prompts({
    type: "text",
    name: "authorUrl",
    message: "What is the link to the authors homepage?",
    initial: "",
  });

  const { language } = await prompts({
    type: "text",
    name: "language",
    message:
      "In which language is your book written? Provide a short code, e.g.: en or de",
    initial: "en",
  });

  const hyperbookJson = {
    name: bookName,
    version: "0.0.0",
    description: description,
    author: {
      name: author,
      url: authorUrl,
    },
    license: "CC-BY-SA",
    language: language,
  };

  fs.writeFileSync(
    path.join(root, "hyperbook.json"),
    JSON.stringify(hyperbookJson, null, 2) + os.EOL
  );

  console.log();
  /**
   * Copy the files to the target directory.
   */
  const filesPath = path.join(__dirname, "templates");
  await cpy("default/**", root, {
    cwd: filesPath,
    rename: (name) => {
      switch (name) {
        case "gitignore": {
          return ".".concat(name);
        }
        // README.md is ignored by webpack-asset-relocator-loader used by ncc:
        // https://github.com/vercel/webpack-asset-relocator-loader/blob/e9308683d47ff507253e37c9bcbb99474603192b/src/asset-relocator.js#L227
        case "README-template.md": {
          return "README.md";
        }
        default: {
          return name;
        }
      }
    },
  });

  await runSetup(template, repoInfo, root);

  if (tryGitInit(root)) {
    console.log("Initialized a git repository.");
    console.log();
  }
  let cdpath: string;
  if (path.join(originalDirectory, bookName) === bookPath) {
    cdpath = bookName;
  } else {
    cdpath = bookPath;
  }

  console.log(`${chalk.green("Success!")} Created ${bookName} at ${bookPath}`);
  console.log("Inside that directory, you can run several commands:");
  console.log();
  console.log(chalk.cyan(`  hyperbook dev`));
  console.log("    Starts the development server.");
  console.log();
  console.log(chalk.cyan(`  hyperbook build`));
  console.log("    Builds the book for production.");
  console.log();
  console.log("We suggest that you begin by typing:");
  console.log();
  console.log(chalk.cyan("  cd"), cdpath);
  console.log(`  ${chalk.cyan(`hyperbook dev`)}`);
  console.log();
}
