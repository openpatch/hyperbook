import os from "os";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

export interface CreateHyperbookOptions {
  bookPath: string;
  name?: string;
  description?: string;
  author?: string;
  authorUrl?: string;
  license?: string;
  language?: string;
  template?: string;
}

export interface CreateHyperbookResult {
  success: boolean;
  root: string;
  bookName: string;
  error?: string;
}

export async function isWriteable(directory: string): Promise<boolean> {
  try {
    await fs.promises.access(directory, (fs.constants || fs).W_OK);
    return true;
  } catch (err) {
    return false;
  }
}

export async function makeDir(
  root: string,
  options = { recursive: true },
): Promise<void> {
  await fs.promises.mkdir(root, options);
}

export function isFolderEmpty(root: string): boolean {
  const validFiles = [
    ".DS_Store",
    ".git",
    ".gitattributes",
    ".gitignore",
    ".gitlab-ci.yml",
    ".hg",
    ".hgcheck",
    ".hgignore",
    ".idea",
    ".npmignore",
    ".travis.yml",
    "LICENSE",
    "Thumbs.db",
    "npm-debug.log",
    "yarn-debug.log",
    "yarn-error.log",
  ];

  const conflicts = fs
    .readdirSync(root)
    .filter((file) => !validFiles.includes(file))
    .filter((file) => !/\.iml$/.test(file));

  return conflicts.length === 0;
}

export function tryGitInit(root: string): boolean {
  try {
    execSync("git --version", { stdio: "ignore" });

    // Check if already in a git repository
    try {
      execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
      return false;
    } catch (_) {
      // Not in a git repo, continue
    }

    // Check if in mercurial repository
    try {
      execSync("hg --cwd . root", { stdio: "ignore" });
      return false;
    } catch (_) {
      // Not in hg repo, continue
    }

    execSync("git init", { stdio: "ignore", cwd: root });
    execSync("git checkout -b main", { stdio: "ignore", cwd: root });
    execSync("git add -A", { stdio: "ignore", cwd: root });
    execSync('git commit -m "Initial commit from Hyperbook"', {
      stdio: "ignore",
      cwd: root,
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Create a new Hyperbook project
 * @param options - Configuration options for the new project
 * @returns Result indicating success or failure
 */
export async function createHyperbook(
  options: CreateHyperbookOptions,
): Promise<CreateHyperbookResult> {
  const {
    bookPath,
    name,
    description = "",
    author = "",
    authorUrl = "",
    license = "cc-by",
    language = "en",
    template = "default",
  } = options;

  if (!bookPath || bookPath.trim() === "") {
    return {
      success: false,
      root: "",
      bookName: "",
      error: "Book path is required",
    };
  }

  const root = path.resolve(bookPath.trim());

  // Check if directory is writeable
  if (!(await isWriteable(path.dirname(root)))) {
    return {
      success: false,
      root,
      bookName: "",
      error: "The book path is not writable, please check folder permissions.",
    };
  }

  const bookName = name || path.basename(root);

  // Create directory
  try {
    await makeDir(root);
  } catch (err) {
    return {
      success: false,
      root,
      bookName,
      error: `Failed to create directory: ${err}`,
    };
  }

  // Check if folder is empty
  if (!isFolderEmpty(root)) {
    return {
      success: false,
      root,
      bookName,
      error: "Directory is not empty",
    };
  }

  // Create hyperbook.json
  const hyperbookJson = {
    name: bookName,
    version: "0.0.0",
    description: description,
    license,
    author: {
      name: author,
      url: authorUrl,
    },
    language: language,
  };

  try {
    fs.writeFileSync(
      path.join(root, "hyperbook.json"),
      JSON.stringify(hyperbookJson, null, 2) + os.EOL,
    );
  } catch (err) {
    return {
      success: false,
      root,
      bookName,
      error: `Failed to write hyperbook.json: ${err}`,
    };
  }

  // Copy template files
  try {
    const templateDir = template
      ? path.join(__dirname, `./templates/${template}`)
      : path.join(__dirname, "./templates/default");

    if (fs.existsSync(templateDir)) {
      await copyTemplateFiles(templateDir, root);
    }
  } catch (err) {
    return {
      success: false,
      root,
      bookName,
      error: `Failed to copy template files: ${err}`,
    };
  }

  // Initialize git repository
  tryGitInit(root);

  return {
    success: true,
    root,
    bookName,
  };
}

async function copyTemplateFiles(from: string, to: string): Promise<void> {
  const entries = await fs.promises.readdir(from, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    let destPath = path.join(to, entry.name);

    // Handle special file renames
    if (entry.name === "gitignore") {
      destPath = path.join(to, ".gitignore");
    } else if (entry.name === "README-template.md") {
      destPath = path.join(to, "README.md");
    }

    if (entry.isDirectory()) {
      await fs.promises.mkdir(destPath, { recursive: true });
      await copyTemplateFiles(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}
