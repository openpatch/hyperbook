import path from "path";
import fs from "fs/promises";
import { HyperlibraryJson } from "@hyperbook/types";
import { findUp } from "find-up";
import { readJsonFile } from "./json";

export const getJson = async (root: string): Promise<HyperlibraryJson> => {
  return readJsonFile<HyperlibraryJson>(path.join(root, "hyperlibrary.json"));
};

export const find = async (file: string): Promise<HyperlibraryJson> => {
  return findUp("hyperlibrary.json", {
    cwd: file,
  } as any)
    .then((f) => {
      if (!f) {
        throw new Error("Could not find hyperlibrary.json");
      }
      return fs.readFile(f);
    })
    .then((f) => JSON.parse(f.toString()));
};

export const findRoot = async (file: string): Promise<string> => {
  return findUp("hyperlibrary.json", {
    cwd: file,
  } as any).then((f) => {
    if (!f) {
      throw new Error("Could not find hyperlibrary.json");
    }
    return path.parse(f).dir;
  });
};
