import path from "path";
import fs from "fs";
import { ZipArchive } from "archiver";
import chalk from "chalk";
import type { ArchiveInclude } from "@hyperbook/markdown";

/** Includes per archive name, collected from the built pages. */
export type ArchiveIncludes = Record<string, ArchiveInclude[]>;

/** A checked include, ready to be added to a zip. */
interface ArchiveEntryPlan {
  /** Absolute path of the file or folder to add. */
  src: string;
  /** Destination inside the zip, relative, posix separators. */
  dest: string;
  directory: boolean;
}

const isInside = (parent: string, child: string): boolean =>
  child === parent || child.startsWith(parent + path.sep);

/** Every file below `dir`, as slash-separated paths relative to `dir`. */
function listFiles(dir: string, base = ""): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    // stat, not the entry's own type: symlinked folders are walked, matching
    // how the glob below follows symbolic links.
    if (fs.statSync(absolute).isDirectory()) {
      files.push(
        ...listFiles(absolute, base ? `${base}/${entry.name}` : entry.name),
      );
    } else {
      files.push(base ? `${base}/${entry.name}` : entry.name);
    }
  }
  return files;
}

/**
 * Validates an archive's includes against the book and the archive folder, and
 * turns them into a plan the zip step can apply without further checks.
 *
 * Everything here fails loudly and names the markdown file that declared the
 * include, so a broken book surfaces with an actionable message in the build
 * log (Hyperbook Cloud shows exactly this output).
 */
function planIncludes(
  root: string,
  archiveName: string,
  includes: ArchiveInclude[],
): ArchiveEntryPlan[] {
  const rootAbs = path.resolve(root);
  const archiveDir = path.join(root, "archives", archiveName);
  // The glob below zips the whole archive folder, so claim its entries first:
  // an include destination that would overwrite one of them is an error.
  const claimed = new Set<string>(listFiles(archiveDir));
  const plan: ArchiveEntryPlan[] = [];

  const declaredIn = (inc: ArchiveInclude): string =>
    inc.source ? ` (declared in ${inc.source})` : "";

  for (const inc of includes) {
    const src = path.resolve(rootAbs, "." + inc.src);
    if (!isInside(rootAbs, src)) {
      throw new Error(
        `Cannot build archive "${archiveName}": include "${inc.src}=${inc.dest}"${declaredIn(inc)} leaves the book root ${rootAbs}. The source must be inside the book.`,
      );
    }
    if (!fs.existsSync(src)) {
      throw new Error(
        `Cannot build archive "${archiveName}": include "${inc.src}=${inc.dest}"${declaredIn(inc)} points at ${src}, which does not exist.`,
      );
    }
    const directory = fs.statSync(src).isDirectory();
    const claim = (entry: string): void => {
      if (claimed.has(entry)) {
        throw new Error(
          `Cannot build archive "${archiveName}": include "${inc.src}=${inc.dest}"${declaredIn(inc)} wants to add "${entry}", but the archive already contains it. Choose another destination inside the zip.`,
        );
      }
      claimed.add(entry);
    };
    if (directory) {
      for (const file of listFiles(src)) {
        claim(`${inc.dest}/${file}`);
      }
    } else {
      claim(inc.dest);
    }
    plan.push({ src, dest: inc.dest, directory });
  }

  return plan;
}

async function archiveFolder(
  root: string,
  out: string,
  name: string,
  prefix?: string,
  plan: ArchiveEntryPlan[] = [],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const archivesPath = path.join(out, "archives");
    if (!fs.existsSync(archivesPath)) {
      fs.mkdirSync(archivesPath, { recursive: true });
    }
    const outputPath = path.join(archivesPath, name + ".zip");
    const output = fs.createWriteStream(outputPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("finish", () => {
      console.log(`${chalk.blue(`[${prefix}]`)} Archive ${name} zipped.`);
      resolve();
    });
    archive.on("error", (err: Error) => {
      throw err;
    });

    archive.pipe(output);

    // Follow symbolic links: an archive may link to files that also live
    // elsewhere in the book (e.g. an assets folder the pages use), and the
    // download has to contain the files, not a link pointing outside of it.
    archive.glob("**", {
      cwd: path.join(root, "archives", name),
      dot: true,
      follow: true,
    });

    // Extra files pulled in via the directive's include= attribute. Destinations
    // are already validated relative posix paths, so zip entry names stay
    // forward-slashed on every platform.
    for (const entry of plan) {
      if (entry.directory) {
        archive.directory(entry.src, entry.dest);
      } else {
        archive.file(entry.src, { name: entry.dest });
      }
    }

    archive.finalize();
  });
}

export async function runArchive(
  root: string,
  out: string,
  prefix?: string,
  includes: ArchiveIncludes = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    // find folders in archives
    if (!fs.existsSync(path.join(root, "archives"))) {
      console.log(`${chalk.blue(`[${prefix}]`)} No archives found.`);
      resolve();
    } else {
      console.log(`${chalk.blue(`[${prefix}]`)} Zipping archives.`);
      const dirs = fs
        .readdirSync(path.join(root, "archives"), {
          withFileTypes: true,
        })
        .filter((d) => d.isDirectory());

      // Includes only extend existing archive folders — the directive still
      // links to the zip built from archives/<name>/. Validate every archive
      // up front, so a broken include fails the build before any zip is
      // half-written.
      const plans: { name: string; plan: ArchiveEntryPlan[] }[] = dirs.map(
        (d) => ({ name: d.name, plan: [] }),
      );
      for (const name of Object.keys(includes)) {
        const dir = plans.find((p) => p.name === name);
        if (!dir) {
          const declaredIn = includes[name].find((inc) => inc.source)?.source;
          throw new Error(
            `Cannot build archive "${name}": includes are declared for it${
              declaredIn ? ` in ${declaredIn}` : ""
            }, but there is no folder ${path.join(root, "archives", name)}. Create the folder — it can stay empty.`,
          );
        }
        dir.plan = planIncludes(root, name, includes[name]);
      }

      Promise.all(
        plans.map((p) => archiveFolder(root, out, p.name, prefix, p.plan)),
      )
        .then(() => {
          resolve();
        })
        .catch((e) => {
          reject(e);
        });
    }
    // zip folders in archives to public/archives
  });
}
