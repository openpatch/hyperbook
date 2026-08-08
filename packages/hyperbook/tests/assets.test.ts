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
  it("serves them out of the build", () => {
    const { makeUrl } = ctxFor({});
    expect(makeUrl(["directive-onlineide", "app.js"], "assets")).toContain(
      "/__hyperbook_assets/directive-onlineide/app.js",
    );
  });

  it("serves them below the base path", () => {
    const { makeUrl } = ctxFor({}, "docs");
    expect(makeUrl(["shell.css"], "assets")).toContain(
      "/docs/__hyperbook_assets/shell.css",
    );
  });

  it("gives the folder itself, for the client to build addresses from", () => {
    const { makeUrl } = ctxFor({}, "docs");
    expect(makeUrl("/", "assets")).toBe("/docs/__hyperbook_assets/");
  });
});
