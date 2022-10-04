import fs from "fs";
import os from "os";

export async function makeSymlink(src: string, dst: string): Promise<void> {
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
