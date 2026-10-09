import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

describe.each(["editor", "player"])("Blockflow %s client", (mode: string) => {
  const script = readFileSync(
    new URL(`../assets/directive-blockflow-${mode}/client.js`, import.meta.url),
    "utf8",
  );

  function rewrite(
    src: string,
    baseURI = "https://example.com/course/lesson/",
  ) {
    let result = src;
    runInNewContext(script, {
      URL,
      window: { origin: new URL(baseURI).origin },
      document: {
        baseURI,
        querySelectorAll: () => [
          {
            getAttribute: () => result,
            setAttribute: (_: string, value: string) => {
              result = value;
            },
          },
        ],
        addEventListener: (_: string, callback: () => void) => callback(),
      },
    });
    return result;
  }

  it("resolves a local iframe and project against the book page", () => {
    const src = `/course/__hyperbook_assets/directive-blockflow/${mode}.html?project=${encodeURIComponent("./project.sb3")}`;
    const url = new URL(rewrite(src));
    expect(url.pathname).toBe(
      `/course/__hyperbook_assets/directive-blockflow/${mode}.html`,
    );
    expect(url.searchParams.get("project")).toBe(
      "https://example.com/course/lesson/project.sb3",
    );
  });

  it("preserves absolute project URLs", () => {
    const src = `/course/__hyperbook_assets/directive-blockflow/${mode}.html?project=${encodeURIComponent("https://other.example/project.sb3")}`;
    expect(rewrite(src)).toBe(src);
  });

  it("supports VS Code resource URLs", () => {
    const base =
      "https://file+.vscode-resource.vscode-cdn.net/workspace/book/lesson.html";
    const src = `https://file+.vscode-resource.vscode-cdn.net/extension/assets/directive-blockflow/${mode}.html?project=${encodeURIComponent("../public/project.sb3")}`;
    expect(new URL(rewrite(src, base)).searchParams.get("project")).toBe(
      "https://file+.vscode-resource.vscode-cdn.net/workspace/public/project.sb3",
    );
  });
});
