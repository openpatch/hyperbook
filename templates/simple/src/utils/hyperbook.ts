import fs from "fs";
import path from "path";

export type Hyperbook = {
  name: string;
  version: string;
  description?: string;
  author?: {
    name: string;
    url: string;
  };
  license: string;
  logo?: string;
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
