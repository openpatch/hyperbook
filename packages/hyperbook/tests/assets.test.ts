import { describe, expect, it } from "vitest";
import { makeBaseCtx, assetElement } from "../build";
import { HyperbookJson } from "@hyperbook/types";

const ctxFor = (config: Partial<HyperbookJson>, basePath?: string) =>
  makeBaseCtx("/root", { name: "Book", ...config } as HyperbookJson, basePath, {
    type: "book",
    name: "Book",
    src: "/root",
  });

describe("which element an asset belongs to", () => {
  it("reads it off the folder of a directive", () => {
    expect(assetElement(["directive-onlineide", "index.html"])).toBe(
      "onlineide",
    );
  });

  it("knows emojis, which are asked for by name", () => {
    expect(assetElement(["emoji", "1f427.svg"])).toBe("emoji");
  });

  it("belongs to no element when it is part of the shell", () => {
    expect(assetElement(["shell.css"])).toBeNull();
    expect(assetElement(["math", "katex.min.css"])).toBeNull();
  });
});

describe("where assets are served from", () => {
  it("copies them into the build by default", () => {
    const { makeUrl } = ctxFor({});
    expect(makeUrl(["directive-onlineide", "app.js"], "assets")).toContain(
      "/__hyperbook_assets/directive-onlineide/app.js",
    );
  });

  it("serves an element that opted in, pinned to a version", () => {
    const { makeUrl } = ctxFor({ elements: { onlineide: { cdn: true } } });
    expect(makeUrl(["directive-onlineide", "app.js"], "assets")).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/hyperbook@[^/]+\/dist\/assets\/directive-onlineide\/app\.js$/,
    );
  });

  it("leaves an element that did not opt in in the build", () => {
    const { makeUrl } = ctxFor({ elements: { onlineide: { cdn: true } } });
    expect(makeUrl(["directive-sqlide", "app.js"], "assets")).toContain(
      "/__hyperbook_assets/directive-sqlide/app.js",
    );
  });

  it("leaves the shell in the build, whatever opted in", () => {
    const { makeUrl } = ctxFor({
      elements: { onlineide: { cdn: true }, emoji: { cdn: true } },
    });
    expect(makeUrl(["shell.css"], "assets")).toContain(
      "/__hyperbook_assets/shell.css",
    );
  });

  it("serves emojis when they opted in", () => {
    const { makeUrl } = ctxFor({ elements: { emoji: { cdn: true } } });
    expect(makeUrl(["emoji", "1f427.svg"], "assets")).toContain(
      "/dist/assets/emoji/1f427.svg",
    );
  });

  it("serves them from a mirror of your own", () => {
    const { makeUrl } = ctxFor({
      elements: { emoji: { cdn: "https://assets.example.org/hyperbook/" } },
    });
    expect(makeUrl(["emoji", "1f427.svg"], "assets")).toBe(
      "https://assets.example.org/hyperbook/emoji/1f427.svg",
    );
  });

  it("keeps what the build writes itself in the build", () => {
    const { makeUrl } = ctxFor({ elements: { emoji: { cdn: true } } });
    expect(
      makeUrl(["emoji", "x.svg"], "assets", undefined, { local: true }),
    ).toContain("/__hyperbook_assets/emoji/x.svg");
  });

  it("does not add a version query to an address that has one", () => {
    const { makeUrl } = ctxFor({ elements: { emoji: { cdn: true } } });
    expect(
      makeUrl(["emoji", "x.svg"], "assets", undefined, { versioned: true }),
    ).not.toContain("?v=");
  });
});
