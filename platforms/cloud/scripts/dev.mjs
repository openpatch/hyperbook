// Runs the API server (restarting on change) and the Vite dev server together.
// Open the admin UI at http://localhost:5173; books answer on
// http://<slug>.books.localhost:3001. If a port is taken:
//   PORT=3101 WEB_PORT=5273 pnpm dev
import { spawn } from "node:child_process";

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
