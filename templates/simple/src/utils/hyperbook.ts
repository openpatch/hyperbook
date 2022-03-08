import fs from "fs";
import path from "path";

export type Hyperbook = {
  name: string;
  version: string;
  description?: string;
  author: string;
  license: string;
  logo?: string;
  colors?: {
    accent?: string;
    header?: string;
  };
  repo?: string;
  language: string;
  template?: string;
};

export const getHyperbook = async (): Promise<Hyperbook> => {
  return new Promise((resolve, reject) => {
    fs.readFile(path.join(process.cwd(), "hyperbook.json"), (err, data) => {
      if (err) {
        reject();
      } else {
        const j = JSON.parse(data.toString());
        resolve(j as any);
      }
    });
  });
};
