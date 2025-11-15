import { HyperbookContext } from "@hyperbook/types";
import path from "path";
import fs from "fs";

export const readFile = (src: string, ctx: HyperbookContext) => {
  let srcFile = null;
  try {
    srcFile = fs.readFileSync(path.join(ctx.root, "public", src), "utf-8");
  } catch (e) {
    try {
      srcFile = fs.readFileSync(path.join(ctx.root, "book", src), "utf-8");
    } catch (e) {
      try {
        srcFile = fs.readFileSync(
          path.join(
            ctx.root,
            "book",
            ctx.navigation.current?.path?.directory || "",
            src,
          ),
          "utf-8",
        );
      } catch (e) {
        // File not found in any location
        return null;
      }
    }
  }
  return srcFile;
};
