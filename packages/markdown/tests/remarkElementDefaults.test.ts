import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import { ctx as baseCtx } from "./mock";
import { process } from "../src/process";

const toHtml = async (md: string, elements: Record<string, any>) => {
  const ctx = {
    ...baseCtx,
    config: { ...baseCtx.config, elements },
  } as HyperbookContext;
  return String((await process(md, ctx)).value);
};

describe("defaults for the parameters of an element", () => {
  it("uses a default from the configuration", async () => {
    const html = await toHtml("::qr{value=https://example.org}", {
      qr: { size: "L" },
    });
    expect(html).toContain("256");
  });

  it("keeps what the element sets itself", async () => {
    const html = await toHtml("::qr{value=https://example.org size=S}", {
      qr: { size: "L" },
    });
    expect(html).toContain("64");
    expect(html).not.toContain("256");
  });

  it("leaves an element alone that has no configuration", async () => {
    const html = await toHtml("::qr{value=https://example.org}", {
      sqlide: { height: "500px" },
    });
    expect(html).toContain("128");
  });

  it("does not turn what is not a parameter into one", async () => {
    const html = await toHtml("::qr{value=https://example.org}", {
      qr: { cdn: true, version: "1.2.3" },
    });
    expect(html).not.toContain("cdn");
    expect(html).not.toContain("1.2.3");
  });
});
