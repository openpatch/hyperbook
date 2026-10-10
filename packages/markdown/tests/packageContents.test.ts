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
import packageJson from "../package.json";

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

it("publishes integration files without any large element runtimes", () => {
  const files = packedFiles();
  expect(files).toContain("dist/index.js");
  expect(files).toContain("dist/assets/directive-blockflow-player/client.js");
  for (const element of elements) {
    for (const file of elementCoreFiles[element])
      expect(files).toContain(`dist/assets/directive-${element}/${file}`);
    for (const file of elementRuntimeFiles[element]) {
      const packed = files.includes(`dist/assets/directive-${element}/${file}`);
      expect(packed, `${element}: ${file}`).toBe(false);
    }
  }
}, 60_000);

it("renders with the built ESM package in plain Node", () => {
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
        const { process: render } = await import(process.argv[1]);
        const result = await render('# Standalone renderer', {
          root: process.cwd(),
          config: { name: 'Standalone' },
          makeUrl: parts => Array.isArray(parts) ? parts.join('/') : parts,
          navigation: {
            current: { name: 'Standalone' }, next: null, previous: null,
            pages: [], sections: [], glossary: []
          }
        });
        if (!String(result.value).includes('Standalone renderer'))
          throw new Error('The built package did not render the Markdown.');
      `,
      new URL("../dist/index.js", import.meta.url).href,
    ],
    { stdio: "pipe" },
  );
});
