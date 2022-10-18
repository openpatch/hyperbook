import spawn from "cross-spawn";
import path from "path";
import { isSetup } from "./helpers/is-setup";

export async function runDev(): Promise<void> {
  const root = process.cwd();
  const setup = isSetup(root);
  if (!setup) {
    throw new Error("no setup");
  }
  return new Promise((resolve, reject) => {
    const command = "npm";
    const args = ["run", "next:dev"];
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: path.join(root, ".hyperbook"),
      env: {
        ...process.env,
        ADBLOCK: "1",
        DISABLE_OPENCOLLECTIVE: "1",
      },
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject({ command: `${command} ${args.join(" ")}` });
        return;
      }
      resolve();
    });
  });
}
