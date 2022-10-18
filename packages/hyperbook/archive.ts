import path from "path";
import { isSetup } from "./helpers/is-setup";
import fs from "fs";
import archiver from "archiver";
import chalk from "chalk";

async function archiveFolder(
  root: string,
  name: string,
  prefix?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const archivesPath = path.join(root, "public", "archives");
    if (!fs.existsSync(archivesPath)) {
      fs.mkdirSync(archivesPath, { recursive: true });
    }
    const outputPath = path.join(archivesPath, name + ".zip");
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("finish", () => {
      console.log(`${chalk.green(`[${prefix}]`)} Archive ${name} zipped.`);
      resolve();
    });
    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(output);

    archive.directory(path.join(root, "archives", name), false);
    archive.finalize();
  });
}

export async function runArchive(root: string, prefix?: string): Promise<void> {
  const setup = isSetup(root);
  if (!setup) {
    throw new Error("no setup");
  }
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

      Promise.all(dirs.map((d) => archiveFolder(root, d.name, prefix)))
        .then(() => {
          resolve();
        })
        .catch(() => {
          reject();
        });
    }
    // zip folders in archives to public/archives
  });
}
