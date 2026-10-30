// Runs the API server (restarting on change) and the Vite dev server together.
// Open the admin UI at http://localhost:5173; books answer on
// http://<slug>.books.localhost:3001. If a port is taken:
//   PORT=3101 WEB_PORT=5273 pnpm dev
//
// Production gets .env via env_file (Docker) or --env-file (bare metal); in
// dev there is neither, so load it here when it exists. Variables already set
// in the shell win, exactly as with --env-file.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const envFile = new URL("../.env", import.meta.url);
if (existsSync(envFile)) {
  for (const [key, value] of Object.entries(parseEnv(readFileSync(envFile, "utf8")))) {
    if (!(key in process.env)) process.env[key] = value;
  }
}

const children = [
  spawn("tsx", ["watch", "--clear-screen=false", "src/server/main.ts"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "development" },
  }),
  spawn("vite", [], { stdio: "inherit" }),
];

// Signal each child once: tsx force-kills the server on a second signal.
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) {
  child.on("exit", (code) => {
    stop();
    process.exitCode = code ?? 0;
  });
}
