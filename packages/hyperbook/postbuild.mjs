import path from "path";
import { cp, readFile, writeFile, mkdir, readdir, lstat } from "fs/promises";
import { createReadStream } from "fs";
import { createHash } from "crypto";
import { create } from "tar";
import { fileURLToPath } from "url";
import { elementCoreFiles } from "@hyperbook/types";

const packagePath = path.dirname(fileURLToPath(import.meta.url));
const remoteDirectives = JSON.parse(
  await readFile(path.join(packagePath, "asset-bundles.json"), "utf8"),
);

async function bundleFiles(root, directory, files = {}) {
  for (const name of (await readdir(path.join(root, directory))).sort()) {
    const relative = path.posix.join(directory, name);
    const stat = await lstat(path.join(root, relative));
    if (stat.isDirectory()) await bundleFiles(root, relative, files);
    else if (stat.isFile()) files[relative] = stat.size;
    else
      throw new Error(
        `Asset bundle contains a link or special file: ${relative}`,
      );
  }
  return files;
}

async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function postbuild() {
  const markdownAssets = path.join(
    ...["./node_modules", "@hyperbook", "markdown", "dist", "assets"],
  );
  const distAssets = path.join(...["./dist", "assets"]);

  // Keep these exact build outputs for publishing separately from the CLI.
  // Tarballs stay outside dist/, which is the npm package's only files entry.
  const { version } = JSON.parse(await readFile("package.json", "utf8"));
  const bundlesOut = path.join(".cache", "asset-bundles", version);
  await mkdir(bundlesOut, { recursive: true });
  const manifest = { format: 1, version, bundles: {} };
  for (const directive of remoteDirectives) {
    const directory = `directive-${directive}`;
    const files = await bundleFiles(markdownAssets, directory);
    const filename = `${directive}.tar.gz`;
    const archive = path.join(bundlesOut, filename);
    await create(
      {
        file: archive,
        cwd: markdownAssets,
        gzip: true,
        portable: true,
        noMtime: true,
        noDirRecurse: true,
      },
      Object.keys(files),
    );
    manifest.bundles[directive] = {
      url: `https://github.com/openpatch/hyperbook/releases/download/hyperbook-assets-v${version}/${filename}`,
      sha256: await digest(archive),
      bytes: (await lstat(archive)).size,
      files,
    };
  }
  await writeFile(
    path.join("dist", "asset-manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  await cp(markdownAssets, distAssets, {
    recursive: true,
    filter: (src) => {
      // Exclude source module directories — only bundled output belongs in dist.
      const rel = path.relative(markdownAssets, src);
      const parts = rel.split(path.sep);
      const directive = remoteDirectives.find(
        (name) => parts[0] === `directive-${name}`,
      );
      if (directive)
        return (
          parts.length === 1 ||
          elementCoreFiles[directive].includes(parts.slice(1).join("/"))
        );
      // Skip any src/ subdirectory inside a directive-* folder.
      return !(parts[0]?.startsWith("directive-") && parts[1] === "src");
    },
  });

  const templates = path.join(
    ...["./node_modules", "create-hyperbook", "dist", "templates"],
  );
  const distTemplates = path.join(...["./dist", "templates"]);
  await cp(templates, distTemplates, { recursive: true });

  const distLocales = path.join(...["./dist", "locales"]);
  const markdownLocales = path.join(
    ...["./node_modules", "@hyperbook", "markdown", "dist", "locales"],
  );
  await cp(markdownLocales, distLocales, { recursive: true });

  // Config schemas, generated from @hyperbook/types by the VS Code extension's
  // build and committed there. `hyperbook check` uses them to flag config keys
  // that Hyperbook would otherwise ignore in silence.
  const schemas = path.join(...["..", "..", "platforms", "vscode", "schemas"]);
  const distSchemas = path.join(...["./dist", "schemas"]);
  await cp(schemas, distSchemas, { recursive: true });

  const distLunrLanguages = path.join(...["./dist", "lunr-languages"]);
  const lunrLanguages = path.join(
    ...["./node_modules", "lunr-languages", "min"],
  );
  await cp(lunrLanguages, distLunrLanguages, { recursive: true });
}
postbuild();
