import { describe, expect, it } from "vitest";
import { ctx, realCtx } from "./mock";
import { process } from "../src/process";
import { HyperbookContext } from "@hyperbook/types/dist";

describe("process", () => {
  it("should transform", async () => {
    const result = await process(
      `::::tabs{id="code"}
:::tab{title="Java" id="java"}
Java
:::
:::tab{title="Python" id="python"}
Python
::::

Another tabs cluster with the same ids.
::::tabs{id="code"}
:::tab{title="Java"}
Java
:::
:::tab{title="Python" id="python"}
Python
:::
:::tab{title="C" id="c"}
C
:::
:::tab{title="YouTube" id="c"}

::youtube[Hi]{#1234}

:::
::::
`,
      ctx,
    );
    expect(result.value).toMatchSnapshot();
  });
  it("should transfrom complex context", async () => {
    const result = await process("", realCtx);
    expect(result.value).toMatchSnapshot();
  });
  it("should add showLineNumbers", async () => {
    const result = await process(
      `
\`\`\`python title="my.py" {1}
def func():
  pass
\`\`\`
`,
      realCtx,
    );
    expect(result.value).toMatchSnapshot();
  });
  it("should use theme from context", async () => {
    const ctx: HyperbookContext = {
      ...realCtx,
      config: {
        ...realCtx.config,
        elements: {
          code: {
            theme: "catppuccin-frappe",
          },
        },
      },
    };
    const result = await process(
      `
\`\`\`python title="my.py" {1}
def func():
  pass
\`\`\`
`,
      ctx,
    );
    expect(result.value).toContain("catppuccin-frappe");
  });
  it("should use dark and light theme from context", async () => {
    const ctx: HyperbookContext = {
      ...realCtx,
      config: {
        ...realCtx.config,
        elements: {
          code: {
            theme: {
              dark: "catppuccin-frappe",
              light: "dracula",
            },
          },
        },
      },
    };
    const result = await process(
      `
\`\`\`python title="my.py" {1}
def func():
  pass
\`\`\`
`,
      ctx,
    );
    expect(result.value).toContain("catppuccin-frappe").toContain("dracula");
  });
  it("should result in two link", async () => {
    const result = await process(
      `
Du kannst das Programm am schnellsten per 
[Kopieren und Einfügen](https://de.wikipedia.org/Kopieren_und_Einfügen)
in den Editor übernehmen. Du musst aber aufpassen: Wie du weißt 
sind die Einrückungen (Leer- und [Tabulatorzeichen](https://de.wikipedia.org/Tabulatorzeichen)
) 
in Python Teil des Programms .
`,
      ctx,
    );
    expect(result.value).toMatchSnapshot();
  });
});
