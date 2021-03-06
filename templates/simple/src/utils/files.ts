import fs from "fs";
import path from "path";

export const getAllFiles = function (
  dirPath: string,
  arrayOfFiles: string[] = []
) {
  const files = fs.readdirSync(path.join(process.cwd(), dirPath));

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
};
