import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
 * The visual editors run in visual.html, a document of their own, and the
 * themable ones (bitflow first) follow Hyperbook's tokens and resolve their
 * light-dark() colours against the frame's color-scheme. That only works if
 * the frame stays a host like a book page: light tokens (the dark ones build
 * on --color-brand-dark), a color-scheme per theme, and a page font and
 * colours. The theme() plugin in vite.config.ts injects the .dark class and
 * the dark tokens into every page, frame included; src/web/visual/theme.css
 * owes the rest. Without it a dark frame left bitflow's palette light, so
 * its editor came out as white cards on a dark canvas — black and white.
 */

const css = readFileSync(
  new URL("../src/web/visual/theme.css", import.meta.url),
  "utf8",
);
const main = readFileSync(
  new URL("../src/web/visual/main.tsx", import.meta.url),
  "utf8",
);

describe("the visual editor frame as a host page", () => {
  it("loads the light tokens, which the dark ones build on", () => {
    // The dark tokens set --color-brand: var(--color-brand-dark), a token of
    // the light set. Both come from packages/markdown/assets; keep them in
    // step with what app.css gives the admin app.
    expect(css).toMatch(/@import\s+"@hyperbook-tokens\/tokens-light\.css"/);
  });

  it("declares a color-scheme per theme, the switch of every light-dark() colour", () => {
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light/);
    expect(css).toMatch(/:root\.dark\s*\{[^}]*color-scheme:\s*dark/);
  });

  it("gives the page its own font and colours, which editors inherit", () => {
    expect(css).toMatch(
      /body\s*\{[^}]*font-family:\s*hyperbook-body,\s*sans-serif/,
    );
    expect(css).toMatch(
      /body\s*\{[^}]*background-color:\s*var\(--color-background\)/,
    );
  });

  it("is part of the frame's entry point", () => {
    expect(main).toContain('import "./theme.css"');
  });

  it("follows the app's theme after load, not only when it first opens", () => {
    // theme.js, injected into the frame by the theme() plugin, sets .dark once
    // before the first paint. The toggle lives in the parent document, and its
    // choice reaches the frame as a storage event — which is what lib/theme
    // listens for, for every editor, whatever its chunk.
    expect(main).toContain('import "@/lib/theme"');
  });
});
