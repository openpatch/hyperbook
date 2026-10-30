import { describe, expect, it } from "vitest";
import {
  DownloadableElement,
  elementCdn,
  hostedRuntime,
} from "@hyperbook/types";
import { process as processMarkdown } from "../src/process";
import { elementAssetUrl } from "../src/elementAssets";
import ideReleases from "../ide-releases.json";
import openscadConfig from "../openscad-config.json";
import excalidrawPackageJson from "../../web-component-excalidraw/package.json";
import { ctx } from "./mock";

const elements: [DownloadableElement, string][] = [
  ["pyide", "::pyide"],
  ["typst", "::typst"],
  ["geogebra", "::geogebra"],
  ["openscad", "::openscad"],
  ["excalidraw", "::excalidraw"],
  ["onlineide", ":::onlineide\n```java\nprintln(1);\n```\n:::"],
  ["sqlide", ":::sqlide\n```sql\nselect 1;\n```\n:::"],
  ["blockflow", '::blockflow-player{src="/game.sb3"}'],
];

describe.each(elements)(
  "%s CDN configuration",
  (element: DownloadableElement, markdown: string) => {
    it("defaults to CDN for PyIDE and local assets for other elements", async () => {
      const defaults = await processMarkdown(markdown, ctx);
      const configured = await processMarkdown(markdown, {
        ...ctx,
        config: {
          ...ctx.config,
          elements: {
            ...ctx.config.elements,
            [element]: {
              ...ctx.config.elements?.[element],
              cdn: element === "pyide",
            },
          },
        },
      });
      expect(defaults.value).toBe(configured.value);
      expect(defaults.data.directives).toEqual(configured.data.directives);
    });

    it("accepts explicit false for local assets", async () => {
      const disabled = await processMarkdown(markdown, {
        ...ctx,
        config: {
          ...ctx.config,
          elements: {
            ...ctx.config.elements,
            [element]: { ...ctx.config.elements?.[element], cdn: false },
          },
        },
      });
      const output =
        String(disabled.value) + JSON.stringify(disabled.data.directives);
      expect(output).not.toContain('data-runtime-url="https://');
      expect(output).not.toContain("https://cdn.");
      expect(output).not.toContain("http://assets.example.com/");
      expect(disabled.data.directives).toHaveProperty(element);
    });

    it("uses the default CDN and a custom HTTP base URL", async () => {
      for (const cdn of [true, "http://assets.example.com/runtime"] as const) {
        const result = await processMarkdown(markdown, {
          ...ctx,
          config: { ...ctx.config, elements: { [element]: { cdn } } },
        });
        const output =
          String(result.value) + JSON.stringify(result.data.directives);
        expect(output).toContain(
          cdn === true
            ? {
                pyide: "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/",
                typst: "https://cdn.jsdelivr.net/npm/@myriaddreamin/",
                geogebra: "https://www.geogebra.org/apps/",
                blockflow: "https://blockflow.openpatch.org/",
                excalidraw:
                  "https://unpkg.com/@hyperbook/web-component-excalidraw@",
                onlineide: `https://cdn.openpatch.org/onlineide/${ideReleases.onlineide}/`,
                sqlide: `https://cdn.openpatch.org/sqlide/${ideReleases.sqlide}/`,
                openscad: `https://cdn.openpatch.org/openscad/${openscadConfig.wasmBuild.cdnVersion}/`,
              }[element]
            : "http://assets.example.com/runtime/",
        );
        if (element === "blockflow")
          expect(result.data.directives).not.toHaveProperty("blockflow");
        if (element === "onlineide" || element === "sqlide")
          expect(result.data.js).toContainEqual(["cdn-workers.js"]);
      }
    });
  },
);

it("resolves custom Pyodide URLs relative to the distribution root", () => {
  const configured = {
    ...ctx,
    config: {
      ...ctx.config,
      elements: { pyide: { cdn: "https://example.com/pyodide" } },
    },
  };
  expect(elementAssetUrl(configured, "pyide", "pyodide/")).toBe(
    "https://example.com/pyodide/",
  );
  expect(elementAssetUrl(configured, "pyide", "pyodide/pyodide.js")).toBe(
    "https://example.com/pyodide/pyodide.js",
  );
});

it.each([
  "ftp://example.com/",
  "javascript:alert(1)",
  "/relative",
  "",
  "https://example.com/?q=1",
  "https://example.com/#fragment",
  12,
  null,
])("rejects invalid CDN settings: %s", (cdn: unknown) => {
  expect(() =>
    elementCdn(
      { name: "Invalid", elements: { pyide: { cdn: cdn as string } } },
      "pyide",
    ),
  ).toThrow("elements.pyide.cdn");
});

it("uses pinned upstream Typst fonts and GeoGebra codebases", () => {
  const configured = {
    ...ctx,
    config: {
      ...ctx.config,
      elements: { typst: { cdn: true }, geogebra: { cdn: true } },
    },
  };
  expect(elementAssetUrl(configured, "typst", "fonts/")).toBe(
    "https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/",
  );
  expect(
    elementAssetUrl(configured, "geogebra", "GeoGebra/HTML5/5.0/web3d/"),
  ).toBe("https://www.geogebra.org/apps/5.4.931.2/web3d/");
});

it("loads Blockflow and Excalidraw from their upstream CDNs", () => {
  const configured = {
    ...ctx,
    config: {
      ...ctx.config,
      elements: { blockflow: { cdn: true }, excalidraw: { cdn: true } },
    },
  };
  expect(elementAssetUrl(configured, "blockflow", "editor.html")).toBe(
    "https://blockflow.openpatch.org/editor.html",
  );
  expect(
    elementAssetUrl(configured, "excalidraw", "hyperbook-excalidraw.umd.js"),
  ).toBe(
    `https://unpkg.com/@hyperbook/web-component-excalidraw@${excalidrawPackageJson.version}/dist/index.umd.js`,
  );
  const excalidraw = `https://unpkg.com/@excalidraw/excalidraw@${excalidrawPackageJson.dependencies["@excalidraw/excalidraw"]}/dist/prod/`;
  expect(elementAssetUrl(configured, "excalidraw", "excalidraw.css")).toBe(
    `${excalidraw}index.css`,
  );
  // Excalidraw resolves fonts/ beside its asset base.
  expect(elementAssetUrl(configured, "excalidraw", "")).toBe(excalidraw);
  // An unpkg URL needs an exact version to stay stable.
  expect(excalidraw).toMatch(/@\d+\.\d+\.\d+\/dist/);
});

it.each([
  ["onlineide", ideReleases.onlineide, "include/online-ide-embedded.js"],
  ["sqlide", ideReleases.sqlide, "include/sql-ide-embedded.js"],
  ["openscad", openscadConfig.wasmBuild.cdnVersion, "openscad.wasm"],
] as const)(
  "pins %s's default CDN independently of the Markdown package",
  (element: DownloadableElement, version: string, file: string) => {
    const configured = {
      ...ctx,
      config: { ...ctx.config, elements: { [element]: { cdn: true } } },
    };
    expect(elementAssetUrl(configured, element, "")).toBe(
      `https://cdn.openpatch.org/${element}/${version}/`,
    );
    expect(elementAssetUrl(configured, element, file)).toBe(
      `https://cdn.openpatch.org/${element}/${version}/${file}`,
    );
  },
);

describe("shared assets of a host (Hyperbook Cloud)", () => {
  const base = "/_hyperbook/assets/0.117.0/";
  const shared = { ...ctx, sharedAssetsBase: base };

  it("takes the place of the default CDN for elements without a cdn setting", () => {
    expect(elementCdn(shared.config, "pyide", base)).toBe(true);
    // Unset defaults to local without a host; the host makes it shared.
    expect(elementCdn(shared.config, "typst")).toBe(false);
    expect(elementCdn(shared.config, "typst", base)).toBe(true);
    // Explicit choices keep their meaning.
    expect(
      elementCdn(
        { ...shared.config, elements: { typst: { cdn: false } } },
        "typst",
        base,
      ),
    ).toBe(false);
    expect(
      elementCdn(
        {
          ...shared.config,
          elements: { typst: { cdn: "https://example.com/t/" } },
        },
        "typst",
        base,
      ),
    ).toBe("https://example.com/t/");
  });

  it("resolves files with the layout of a local build", () => {
    expect(elementAssetUrl(shared, "pyide", "pyodide/pyodide.js")).toBe(
      `${base}directive-pyide/pyodide/pyodide.js`,
    );
    expect(elementAssetUrl(shared, "typst", "fonts/")).toBe(
      `${base}directive-typst/fonts/`,
    );
    expect(elementAssetUrl(shared, "openscad", "")).toBe(
      `${base}directive-openscad`,
    );
    expect(
      elementAssetUrl(shared, "onlineide", "include/online-ide-embedded.js"),
    ).toBe(`${base}directive-onlineide/include/online-ide-embedded.js`);
  });

  it("falls back to the public CDN for elements the host does not serve", () => {
    // A host (an admin of a Hyperbook Cloud instance) may serve only some
    // elements itself and load the rest from their public CDNs.
    const excluded = {
      ...ctx,
      sharedAssetsBase: base,
      cdnElements: ["pyide"],
    };
    expect(hostedRuntime(excluded, "typst")).toBe(base);
    expect(hostedRuntime(excluded, "pyide")).toBe("cdn");
    // The excluded element follows its public CDN, whatever the built-in
    // default would be; the served one keeps the shared base.
    expect(elementAssetUrl(excluded, "pyide", "pyodide/pyodide.js")).toBe(
      `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.js`,
    );
    expect(elementAssetUrl(excluded, "typst", "typst-bundle.js")).toBe(
      `${base}directive-typst/typst-bundle.js`,
    );
  });

  it("serves an element from the public CDN even without a shared base", () => {
    // An instance whose admin set every element to its public CDN passes no
    // base at all; the choice still replaces the built-in default (which
    // keeps a runtime local for all but PyIDE).
    const cdnOnly = { ...ctx, cdnElements: ["typst"] };
    expect(hostedRuntime(cdnOnly, "typst")).toBe("cdn");
    expect(
      elementCdn(cdnOnly.config, "typst", hostedRuntime(cdnOnly, "typst")),
    ).toBe(true);
    const url = elementAssetUrl(cdnOnly, "typst", "typst-bundle.js");
    expect(url).toContain("https://cdn.jsdelivr.net/npm/@myriaddreamin/");
    expect(url).not.toContain("/assets/");
  });

  it("keeps explicit local assets and custom CDNs as they are", async () => {
    const local = {
      ...shared,
      config: { ...ctx.config, elements: { typst: { cdn: false } } },
    };
    expect(elementAssetUrl(local, "typst", "typst-bundle.js")).toBe(
      "/assets/directive-typst/typst-bundle.js",
    );

    const custom = {
      ...shared,
      config: {
        ...ctx.config,
        elements: { typst: { cdn: "https://example.com/t/" } },
      },
    };
    expect(elementAssetUrl(custom, "typst", "typst-bundle.js")).toBe(
      "https://example.com/t/typst-bundle.js",
    );
  });

  it("renders every element against the shared base instead of a public CDN", async () => {
    for (const [element, markdown] of elements) {
      const result = await processMarkdown(markdown, shared);
      const output =
        String(result.value) + JSON.stringify(result.data.directives);
      expect(output).toContain(base);
      expect(output).not.toContain("https://cdn.");
      expect(output).not.toContain("https://www.geogebra.org");
      expect(output).not.toContain("https://blockflow.openpatch.org");
      expect(output).not.toContain("https://unpkg.com/");
    }
  });
});
