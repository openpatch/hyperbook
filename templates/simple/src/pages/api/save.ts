import fs from "fs/promises";
import path from "path";
import { NextApiRequest, NextApiResponse } from "next";

type ReqData = {
  path: string;
  content: string;
  isPublic: boolean;
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResData>
) {
  if (process.env.NODE_ENV !== "development") {
    res.status(404).json({ status: "failed" });
  }
  let { path: p, content, isPublic } = req.body as ReqData;
  if (req.headers["content-type"] == "application/json") {
    content = JSON.stringify(content);
  }
  if (isPublic) {
    p = path.join("public", p);
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
