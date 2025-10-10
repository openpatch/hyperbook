import { HyperbookContext } from "@hyperbook/types";
import { getPathAdapter, getFileSystemAdapter } from "@hyperbook/fs";

export const readFile = (src: string, ctx: HyperbookContext) => {
  const path = getPathAdapter();
  const fs = getFileSystemAdapter();
  
  let srcFile = null;
  try {
    srcFile = fs.readFileSync(path.join(ctx.root, "public", src), "utf-8");
  } catch (e) {
    try {
      srcFile = fs.readFileSync(path.join(ctx.root, "book", src), "utf-8");
    } catch (e) {
      srcFile = fs.readFileSync(
        path.join(
          ctx.root,
          "book",
          ctx.navigation.current?.path?.directory || "",
          src,
        ),
        "utf-8",
      );
    }
  }
  return srcFile;
};
