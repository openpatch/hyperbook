import fs from "fs";

export async function makeSymlink(src: string, dst: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.symlink(src, dst, (err) => {
      if (err) {
        reject();
      } else {
        resolve();
      }
    });
  });
}
