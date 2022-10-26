import fs from "fs";
import path from "path";

export const getAllFiles = function (
  dirPath: string,
  arrayOfFiles: string[] = []
) {
  try {
    const files = fs.readdirSync(dirPath);

    files.forEach(function (file) {
      if (fs.statSync(path.join(dirPath, file)).isDirectory()) {
        arrayOfFiles = getAllFiles(path.join(dirPath, file), arrayOfFiles);
      } else if (file.endsWith(".md") || file.endsWith(".mdx")) {
        arrayOfFiles.push(path.join(dirPath, file));
      }
    });

    return arrayOfFiles;
  } catch (e) {
    return [];
  }
};
