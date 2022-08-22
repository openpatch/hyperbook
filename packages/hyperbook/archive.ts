import path from "path";
import { isSetup } from "./helpers/is-setup";
import fs from "fs";
import archiver from "archiver";
import process from "process";
import chalk from "chalk";

async function archiveFolder(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const archivesPath = path.join(process.cwd(), "public", "archives");
    if (!fs.existsSync(archivesPath)) {
      fs.mkdirSync(archivesPath, { recursive: true });
    }
    const outputPath = path.join(archivesPath, name + ".zip");
    const output = fs.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("finish", () => {
      console.log(chalk.green("Archive zipped: ") + name);
      resolve();
    });
    archive.on("error", (err) => {
      throw err;
    });

    archive.pipe(output);

    archive.directory(path.join(process.cwd(), "archives", name), false);
    archive.finalize();
  });
}

export async function runArchive(): Promise<void> {
  const setup = isSetup();
  if (!setup) {
    return;
  }
  return new Promise((resolve, reject) => {
    // find folders in archives
    if (!fs.existsSync(path.join(process.cwd(), "archives"))) {
      console.log(chalk.blue("info  ") + "- No Archives found");
      resolve();
    }
    const dirs = fs
      .readdirSync(path.join(process.cwd(), "archives"), {
        withFileTypes: true,
      })
      .filter((d) => d.isDirectory());

    Promise.all(dirs.map((d) => archiveFolder(d.name)))
      .then(() => {
        resolve();
      })
      .catch(() => {
        reject();
      });

    // zip folders in archives to public/archives
  });
}
