import path from "path";
import { spawn } from "child_process";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const hyperbook = path.join(
  __dirname,
  "..",
  "packages",
  "hyperbook",
  "dist",
  "index.js"
);
const lang = process.argv[2];

spawn(`node`, [hyperbook, "dev"], {
  stdio: "inherit",
  cwd: path.join(__dirname, "..", "website", lang),
  env: {
    ...process.env,
    HYPERBOOK_LOCAL_DEV: true,
  },
});
