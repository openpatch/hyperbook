import { describe, expect, it } from "vitest";
import { DownloadableElement, elementCdn } from "@hyperbook/types";
import { process as processMarkdown } from "../src/process";
import { elementAssetUrl } from "../src/elementAssets";
import packageJson from "../package.json";
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
    it("keeps local assets as the default and accepts explicit false", async () => {
      const local = await processMarkdown(markdown, ctx);
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
      expect(disabled.value).toBe(local.value);
      expect(disabled.data.directives).toEqual(local.data.directives);
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
              }[element as "pyide" | "typst" | "geogebra"] ||
                `https://unpkg.com/@hyperbook/markdown@${packageJson.version}/dist/assets/directive-${element}/`
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
