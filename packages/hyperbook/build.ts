import spawn from "cross-spawn";
import path from "path";

export async function runBuild(): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = "npm";
    const args = ["run", "build"];
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: path.join(process.cwd(), ".hyperbook"),
      env: { ...process.env, ADBLOCK: "1", DISABLE_OPENCOLLECTIVE: "1" },
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject({ command: `${command} ${args.join(" ")}` });
        return;
      }
      // TODO copy out dir to root folder
      resolve();
    });
  });
}
