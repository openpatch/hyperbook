import fs from "fs/promises";
import path from "path";
import { NextApiRequest, NextApiResponse } from "next";

type ReqData = {
  path: string;
  content: string;
  rootFolder: string;
};

type ResData = {
  status: "saved" | "failed";
};

async function ensureDirectoryExistence(filePath: string) {
  var dirname = path.dirname(filePath);
  try {
    await fs.access(dirname);
    return true;
  } catch (e) {
    fs.mkdir(dirname).then(async () => ensureDirectoryExistence(dirname));
  }
}

// not needed in production
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "32mb",
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResData>
) {
  if (process.env.NODE_ENV !== "development") {
    res.status(404).json({ status: "failed" });
  }
  let { path: p, content, rootFolder } = req.body as ReqData;

  if (rootFolder) {
    p = path.join(rootFolder, p);
  }
  p = path.join(__dirname, "..", "..", "..", "..", p);
  try {
    await ensureDirectoryExistence(p);
    await fs.writeFile(p, content);
    res.status(202).json({ status: "saved" });
  } catch (e) {
    res.status(400).json(e);
  }
}
