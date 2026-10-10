import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DownloadableElement,
  elementCoreFiles,
  elementRuntimeFiles,
} from "@hyperbook/types";
import { expect, it } from "vitest";
import { elementAssetUrl } from "../src/elementAssets";
import packageJson from "../package.json";
import { ctx } from "./mock";

const elements = Object.keys(elementCoreFiles) as DownloadableElement[];

/** What `npm publish` would upload, given a dist tree with every element. */
function packedFiles(): string[] {
  const fixture = mkdtempSync(path.join(tmpdir(), "hyperbook-markdown-pack-"));
  try {
    const { name, version, files } = packageJson;
    writeFileSync(
      path.join(fixture, "package.json"),
      JSON.stringify({ name, version, files }),
    );
    const write = (file: string) => {
      mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true });
      writeFileSync(path.join(fixture, file), "");
    };
    write("dist/index.js");
    write("dist/assets/directive-blockflow-player/client.js");
    for (const element of elements)
      for (const file of [
        ...elementCoreFiles[element],
        ...elementRuntimeFiles[element],
      ])
        write(`dist/assets/directive-${element}/${file}`);
    const [pack] = JSON.parse(
      execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
        cwd: fixture,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
    return pack.files.map((file: { path: string }) => file.path);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

it("publishes only the runtimes its own default CDN serves", () => {
  const files = packedFiles();
  expect(files).toContain("dist/index.js");
  expect(files).toContain("dist/assets/directive-blockflow-player/client.js");
  for (const element of elements) {
    for (const file of elementCoreFiles[element])
      expect(files).toContain(`dist/assets/directive-${element}/${file}`);
    const configured = {
      ...ctx,
      config: { ...ctx.config, elements: { [element]: { cdn: true } } },
    };
    for (const file of elementRuntimeFiles[element]) {
      // Elements whose default CDN is this package on unpkg must ship their
      // runtime. Every other runtime stays out to keep the package small.
      // Directives resolve nested runtime files through their top folder.
      const requested = file.includes("/") ? file.replace(/\/.*/, "/") : file;
      const servedByPackage = elementAssetUrl(
        configured,
        element,
        requested,
      ).startsWith(`https://unpkg.com/${packageJson.name}@`);
      const packed = files.includes(`dist/assets/directive-${element}/${file}`);
      expect(packed, `${element}: ${file}`).toBe(servedByPackage);
    }
  }
}, 60_000);
