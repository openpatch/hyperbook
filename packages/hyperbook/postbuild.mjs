import fs from "fs/promises";
import * as exportableManifest from "@pnpm/exportable-manifest";

async function postbuild() {
  await fs.cp(
    "./node_modules/hyperbook-simple-template/dist",
    "./dist/templates/default/.hyperbook",
    { recursive: true }
  );

  const manifest = await fs
    .readFile("./node_modules/hyperbook-simple-template/package.json")
    .then((f) => JSON.parse(f));

  const publishManifest = await exportableManifest.createExportableManifest(
    "./node_modules/hyperbook-simple-template",
    manifest
  );

  const cleanedManifest = {
    ...publishManifest,
    scripts: {
      "next:dev": "next-hyperbook-watch",
      "next:build": "next build && next export",
    },
    devDependencies: {
      "@hyperbook/next-watch":
        publishManifest.devDependencies["@hyperbook/next-watch"],
    },
  };

  await fs.writeFile(
    "./dist/templates/default/.hyperbook/package.json",
    JSON.stringify(cleanedManifest, null, 2)
  );
}

postbuild();
