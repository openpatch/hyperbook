import path from "path";

export function makeEnv() {
  let NODE_PATH = process.env.NODE_PATH;
  let PATH = process.env.PATH;
  if (process.env.HYPERBOOK_LOCAL_DEV) {
    NODE_PATH = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "templates",
      "simple",
      "node_modules"
    );
    PATH =
      PATH +
      ":" +
      path.join(
        __dirname,
        "..",
        "..",
        "..",
        "templates",
        "simple",
        "node_modules",
        ".bin"
      );
  }

  const env = { NODE_PATH, PATH };
  return env;
}
