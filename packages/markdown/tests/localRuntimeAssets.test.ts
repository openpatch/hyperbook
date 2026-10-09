import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { afterEach, expect, it, vi } from "vitest";
import { process as processMarkdown } from "../src/process";
import { ctx } from "./mock";

const baseURI = "https://example.com/course/lesson/";
const assets = "/course/__hyperbook_assets/";
const read = (name: string) =>
  readFileSync(new URL(`../assets/${name}`, import.meta.url), "utf8");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("renders GeoGebra with a local bootstrap and unversioned codebase under the book base path", async () => {
  const result = await processMarkdown(":::geogebra\nA=(1,2)\n:::", {
    ...ctx,
    makeUrl(p, base, current, options) {
      const url = ctx.makeUrl(p, base, current, options);
      return `/course${url}${options?.versioned === false ? "" : "?v=1"}`;
    },
  });
  expect(result.data.directives?.geogebra.scripts).toContain(
    "GeoGebra/deployggb.js",
  );
  expect(String(result.value)).toContain(
    'data-codebase="/course/assets/directive-geogebra/GeoGebra/HTML5/5.0/web3d/"',
  );
});

it("selects GeoGebra's local HTML5 codebase before injecting the applet", () => {
  let element: any;
  const calls: string[] = [];
  runInNewContext(read("directive-geogebra/geogebra-web-component.js"), {
    URL,
    HTMLElement: class {},
    customElements: {
      define: (_name: string, value: any) => {
        element = value;
      },
    },
    document: { baseURI, createElement: () => ({}) },
    window: {
      GGBApplet: class {
        setHTML5Codebase(url: string) {
          calls.push(url);
        }
        inject() {
          calls.push("inject");
        }
      },
    },
  });
  element.prototype.try_create.call({
    hasAttribute: () => false,
    getAttribute: () => `${assets}directive-geogebra/GeoGebra/HTML5/5.0/web3d/`,
    appendChild: () => {},
  });
  expect(calls).toEqual([
    `https://example.com${assets}directive-geogebra/GeoGebra/HTML5/5.0/web3d/`,
    "inject",
  ]);
});

it("loads Pyodide and its package index from local assets", async () => {
  vi.stubGlobal("HYPERBOOK_ASSETS", assets);
  const loadPyodide = vi.fn(async () => ({}));
  const browser: any = {};
  vi.stubGlobal("window", browser);
  let scriptUrl;
  vi.stubGlobal("document", {
    baseURI,
    createElement: () => ({}),
    head: {
      appendChild(script: any) {
        scriptUrl = script.src;
        browser.loadPyodide = loadPyodide;
        script.onload();
      },
    },
  });
  const { getRuntime } =
    // @ts-expect-error The browser client is JavaScript.
    await import("../assets/directive-pyide/src/pyodide.js");
  await getRuntime("test");
  expect(scriptUrl).toBe(
    `https://example.com${assets}directive-pyide/pyodide/pyodide.js`,
  );
  expect(loadPyodide).toHaveBeenCalledWith({
    indexURL: `https://example.com${assets}directive-pyide/pyodide/`,
  });
  await getRuntime("test");
  expect(loadPyodide).toHaveBeenCalledTimes(1);
});

it("returns undefined for cancelled turtle number input so current Pyodide converts it to None", async () => {
  vi.stubGlobal("window", {
    prompt: vi
      .fn()
      .mockReturnValueOnce(null)
      .mockReturnValueOnce("invalid")
      .mockReturnValueOnce("3.5"),
  });
  vi.stubGlobal("hyperbook", { i18n: { get: () => "Input" } });
  vi.stubGlobal("document", {
    createElement: () => ({ getContext: () => ({}) }),
  });
  const { createTurtleJsFFI } =
    // @ts-expect-error The browser client is JavaScript.
    await import("../assets/directive-pyide/src/turtle-ffi.js");
  const turtle = createTurtleJsFFI("test");
  expect(turtle.numinput("Title", "Number")).toBeUndefined();
  expect(turtle.numinput("Title", "Number")).toBeUndefined();
  expect(turtle.numinput("Title", "Number")).toBe(3.5);
});

it("loads Typst WASM and all standard fonts locally while preserving custom fonts", async () => {
  const loadFonts = vi.fn();
  const compiler = vi.fn();
  const renderer = vi.fn();
  const context: any = {
    URL,
    HYPERBOOK_ASSETS: assets,
    hyperbook: {},
    document: { baseURI, getElementsByClassName: () => [] },
    window: {
      TypstCompileModule: { loadFonts },
      $typst: {
        setCompilerInitOptions: compiler,
        setRendererInitOptions: renderer,
      },
    },
  };
  runInNewContext(
    read("directive-typst/client.js").replace(
      "return {};\n})();",
      "return { TypstLoader, CONFIG };\n})();",
    ),
    context,
  );
  const { TypstLoader, CONFIG } = context.hyperbook.typst;
  await new TypstLoader().initializeTypst([{ url: "/course/custom.ttf" }]);
  expect(CONFIG.TYPST_BUNDLE_URL).toBe(
    `https://example.com${assets}directive-typst/typst-bundle.js`,
  );
  expect(compiler.mock.calls[0][0].getModule()).toBe(
    `https://example.com${assets}directive-typst/typst-compiler.wasm`,
  );
  expect(renderer.mock.calls[0][0].getModule()).toBe(
    `https://example.com${assets}directive-typst/typst-renderer.wasm`,
  );
  expect(loadFonts).toHaveBeenCalledWith(["/course/custom.ttf"], {
    assets: ["text"],
    assetUrlPrefix: {
      text: `https://example.com${assets}directive-typst/fonts/`,
    },
  });
});

it("resolves every optional OpenSCAD library and Roboto font beside the worker", async () => {
  const fetch = vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(1),
  }));
  const context: any = {
    URL,
    fetch,
    Uint8Array,
    self: {
      location: {
        href: `https://example.com${assets}directive-openscad/worker.js?v=1`,
      },
      addEventListener: () => {},
    },
  };
  runInNewContext(
    read("directive-openscad/worker.js") +
      "\nglobalThis.runtime = { KNOWN_LIBRARIES, loadFonts };",
    context,
  );
  for (const [name, url] of Object.entries(context.runtime.KNOWN_LIBRARIES)) {
    expect(url).toBe(
      `https://example.com${assets}directive-openscad/libraries/${name}.zip`,
    );
  }
  await context.runtime.loadFonts();
  expect(fetch).toHaveBeenCalledWith(
    `https://example.com${assets}directive-openscad/fonts/Roboto-Regular.ttf`,
  );
});
