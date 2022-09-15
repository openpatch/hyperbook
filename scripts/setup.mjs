import fs from "fs";
import path from "path";
import { cwd } from "process";

const dir = cwd();

async function makeSymlink(src, dst) {
  return new Promise((resolve, reject) => {
    try {
      fs.unlinkSync(dst);
    } catch (e) {}
    fs.symlink(src, dst, (err) => {
      if (err) {
        console.log(err);
        reject();
      } else {
        resolve();
      }
    });
  });
}

async function linkWebsiteToTemplate(template) {
  const website = "website";

  await makeSymlink(
    path.join(dir, website, "archives"),
    path.join(dir, template, "archives")
  );
  await makeSymlink(
    path.join(dir, website, "book"),
    path.join(dir, template, "book")
  );
  await makeSymlink(
    path.join(dir, website, "public"),
    path.join(dir, template, "public")
  );
  await makeSymlink(
    path.join(dir, website, "glossary"),
    path.join(dir, template, "glossary")
  );
  await makeSymlink(
    path.join(dir, website, "hyperbook.json"),
    path.join(dir, template, "hyperbook.json")
  );

  await makeSymlink(
    path.join(dir, template),
    path.join(dir, website, ".hyperbook")
  );
}

linkWebsiteToTemplate("templates/simple");
