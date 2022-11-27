import { Hyperproject } from "@hyperbook/types";
import path from "path";

export function makeEnv(rootProject?: Hyperproject) {
  let NODE_PATH = process.env.NODE_PATH;
  let PATH = process.env.PATH;
  if (process.env.HYPERBOOK_LOCAL_DEV) {
    NODE_PATH = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "platforms",
      "web",
      "node_modules"
    );
    PATH =
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "platforms",
        "web",
        "node_modules",
        ".bin"
      ) +
      ":" +
      PATH;
  }
  if (rootProject) {
    NODE_PATH = path.join(rootProject.src, ".hyperbook", "node_modules");
    PATH =
      path.join(rootProject.src, ".hyperbook", "node_modules", ".bin") +
      ":" +
      PATH;
  }

  const env = { NODE_PATH, PATH };
  return env;
}
