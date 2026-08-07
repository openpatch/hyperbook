import { describe, expect, it } from "vitest";
import { makeBaseCtx } from "../build";
import { HyperbookJson } from "@hyperbook/types";

const ctxFor = (config: Partial<HyperbookJson>, basePath?: string) =>
  makeBaseCtx("/root", { name: "Book", ...config } as HyperbookJson, basePath, {
    type: "book",
    name: "Book",
    src: "/root",
  });

describe("where assets are served from", () => {
  it("copies them into the build by default", () => {
    const { makeUrl } = ctxFor({});
    expect(makeUrl(["shell.css"], "assets", undefined, {})).toBe(
      "/__hyperbook_assets/shell.css",
    );
  });

  it("keeps the base path of the hyperbook", () => {
    const { makeUrl } = ctxFor({}, "docs");
    expect(makeUrl(["shell.css"], "assets", undefined, {})).toBe(
      "/docs/__hyperbook_assets/shell.css",
    );
  });

  it("serves them from a CDN, pinned to a version", () => {
    const { makeUrl } = ctxFor({ assets: { cdn: true } });
    const url = makeUrl(["shell.css"], "assets");
    // The two slashes of the address have to survive being joined to a path.
    expect(url).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/hyperbook@[^/]+\/dist\/assets\/shell\.css$/,
    );
  });

  it("serves them from a mirror of your own", () => {
    const { makeUrl } = ctxFor({
      assets: { cdn: "https://assets.example.org/hyperbook/" },
    });
    expect(makeUrl(["emoji", "1f427.svg"], "assets")).toBe(
      "https://assets.example.org/hyperbook/emoji/1f427.svg",
    );
  });

  it("does not add a version query to an address that has one", () => {
    const { makeUrl } = ctxFor({ assets: { cdn: true } });
    expect(
      makeUrl(["shell.css"], "assets", undefined, { versioned: true }),
    ).not.toContain("?v=");
  });
});
