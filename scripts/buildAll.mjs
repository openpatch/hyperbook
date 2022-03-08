import walk from "walkdir";
import { buildPackage } from "./buildPackage";

const emitter = walk("packages", {
  max_depth: 1,
});

emitter.on("directory", async (path) => {
  await buildPackage(path);
});
emitter.on("error", (err) => console.log(err));
