import path from "path";
import { HyperlibraryJson } from "@hyperbook/types";
import { findUp, readText } from "./filesystem";

export const getJson = async (root: string): Promise<HyperlibraryJson> => {
  return readText(path.join(root, "hyperlibrary.json")).then(JSON.parse);
};

export const find = async (file: string): Promise<HyperlibraryJson> => {
  return findUp("hyperlibrary.json", file)
    .then((f) => {
      if (!f) {
        throw new Error("Could not find hyperlibrary.json");
      }
      return readText(f);
    })
    .then(JSON.parse);
};

export const findRoot = async (file: string): Promise<string> => {
  return findUp("hyperlibrary.json", file).then((f) => {
    if (!f) {
      throw new Error("Could not find hyperlibrary.json");
    }
    return path.parse(f).dir;
  });
};
