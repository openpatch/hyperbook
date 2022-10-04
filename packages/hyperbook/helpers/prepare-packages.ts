import got from "got";
import fs from "fs/promises";
import path from "path";

export async function preparePackages(nextRoot: string) {
  const packageJson = await fs
    .readFile(path.join(nextRoot, "package.json"))
    .then((b) => b.toString("utf8"))
    .then((s) => JSON.parse(s));

  const { dependencies, devDependencies } = packageJson;

  for (let dependency of Object.entries<string>(dependencies)) {
    const [pkg, version] = dependency;
    if (version === "workspace:*") {
      const url = `https://registry.npmjs.org/${encodeURIComponent(pkg)}`;
      const npm = (await got.get(url).json()) as any;
      const npmVersion = npm?.["dist-tags"]?.["latest"];
      if (npmVersion) {
        dependencies[pkg] = npmVersion;
      }
    }
  }

  for (let dependency of Object.entries<string>(devDependencies)) {
    const [pkg, version] = dependency;
    if (version === "workspace:*") {
      const url = `https://registry.npmjs.org/${encodeURIComponent(pkg)}`;
      const npm = (await got.get(url).json()) as any;
      const npmVersion = npm?.["dist-tags"]?.["latest"];
      if (npmVersion) {
        devDependencies[pkg] = npmVersion;
      }
    }
  }

  packageJson["dependencies"] = dependencies;
  packageJson["devDependencies"] = devDependencies;

  await fs.writeFile(
    path.join(nextRoot, "package.json"),
    JSON.stringify(packageJson, null, 2)
  );
}
