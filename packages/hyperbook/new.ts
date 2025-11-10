import chalk from "chalk";
import prompts from "prompts";
import { createHyperbook } from "@hyperbook/create";

export async function runNew({
  programName,
  bookPath,
}: {
  programName: string;
  bookPath: string;
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
      `  ${chalk.cyan(programName)} ${chalk.green("<book-directory>")}`,
    );
    console.log();
    console.log("For example:");
    console.log(`  ${chalk.cyan(programName)} ${chalk.green("my-new-book")}`);
    console.log();
    console.log(
      `Run ${chalk.cyan(`${programName} --help`)} to see all options.`,
    );
    process.exit(1);
  }

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

  let { license } = await prompts({
    type: "select",
    name: "license",
    message: "Pick a license for your book!",
    choices: [
      { title: "Creative Commons Zero (CC0)", value: "cc0" },
      { title: "Creative Commons Attribution (CC BY)", value: "cc-by" },
      {
        title: "Creative Commons Attribution-ShareAlike (CC BY-SA)",
        value: "cc-by-sa",
      },
      {
        title: "Creative Commons Attribution-NoDerivs (CC BY-ND)",
        value: "cc-by-nd",
      },
      {
        title: "Creative Commons Attribution-NonCommercial (CC BY-NC)",
        value: "cc-by-nc",
      },
      {
        title:
          "Creative Commons Attribution-NonCommercial-ShareAlike (CC BY-NC-SA)",
        value: "cc-by-nc-sa",
      },
      {
        title:
          "Creative Commons Attribution-NonCommercial-NoDervis (CC BY-NC-ND)",
        value: "cc-by-nc-nd",
      },
      { title: "Custom", value: "custom" },
    ],
  });

  if (license === "custom") {
    const r = await prompts({
      type: "text",
      name: "license",
      message: "Which custom license you want to use?",
    });
    license = r.license;
  }

  const { language } = await prompts({
    type: "text",
    name: "language",
    message:
      "In which language is your book written? Provide a short code, e.g.: en or de",
    initial: "en",
  });

  const { platform } = await prompts({
    type: "select",
    name: "platform",
    message: "Where do you plan to publish your book?",
    choices: [
      { title: "GitHub", value: "github" },
      { title: "GitLab", value: "gitlab" },
      { title: "EduGit", value: "edugit" },
      { title: "Vercel", value: "vercel" },
      { title: "Custom/Other", value: "custom" },
    ],
    initial: 0,
  });

  console.log();
  console.log(`Creating a new hyperbook...`);
  console.log();

  const result = await createHyperbook({
    bookPath,
    description,
    author,
    authorUrl,
    license,
    language,
    platform,
  });

  if (!result.success) {
    console.error(chalk.red("Error creating hyperbook:"), result.error);
    process.exit(1);
  }

  console.log(
    `${chalk.green("Success!")} Created ${result.bookName} at ${result.root}`,
  );
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
  const originalDirectory = process.cwd();
  const bookName = result.bookName;
  let cdpath: string;
  if (originalDirectory && result.root.startsWith(originalDirectory)) {
    cdpath = bookName;
  } else {
    cdpath = result.root;
  }
  console.log(chalk.cyan("  cd"), cdpath);
  console.log(`  ${chalk.cyan(`hyperbook dev`)}`);
  console.log();
}
