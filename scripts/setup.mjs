import fs from "fs";
import path from "path";
import os from "os";
import rimraf from "rimraf";

async function makeSymlink(src, dst) {
  const type = os.platform() == "win32" ? "junction" : null;
  return new Promise((resolve, reject) => {
    fs.symlink(src, dst, type, (err) => {
      if (err) {
        reject();
      } else {
        resolve();
      }
    });
  });
}

async function setup() {
  rimraf.sync(path.join(process.cwd(), "platforms", "web", "book"));
  await makeSymlink(
    path.join(process.cwd(), "website", "en", "book"),
    path.join(process.cwd(), "platforms", "web", "book")
  );
  rimraf.sync(path.join(process.cwd(), "platforms", "web", "glossary"));
  await makeSymlink(
    path.join(process.cwd(), "website", "en", "glossary"),
    path.join(process.cwd(), "platforms", "web", "glossary")
  );
  rimraf.sync(path.join(process.cwd(), "platforms", "web", "archives"));
  await makeSymlink(
    path.join(process.cwd(), "website", "en", "archives"),
    path.join(process.cwd(), "platforms", "web", "archives")
  );
  rimraf.sync(path.join(process.cwd(), "platforms", "web", "public"));
  await makeSymlink(
    path.join(process.cwd(), "website", "en", "public"),
    path.join(process.cwd(), "platforms", "web", "public")
  );
  rimraf.sync(path.join(process.cwd(), "platforms", "web", "hyperbook.json"));
  await makeSymlink(
    path.join(process.cwd(), "website", "en", "hyperbook.json"),
    path.join(process.cwd(), "platforms", "web", "hyperbook.json")
  );
}

setup();
