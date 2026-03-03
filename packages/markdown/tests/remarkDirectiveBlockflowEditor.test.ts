import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveBlockflowEditor from "../src/remarkDirectiveBlockflowEditor";
import remarkParse from "../src/remarkParse";
import { inflate } from "pako";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveBlockflowEditor(ctx),
  ];

  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype)
    .use(rehypeFormat)
    .use(rehypeStringify, {
      allowDangerousCharacters: true,
      allowDangerousHtml: true,
    })
    .processSync(md);
};

function decodePako(encoded: string): any {
  const prefix = "pako:";
  const b64 = encoded.slice(prefix.length);
  const binary = Buffer.from(b64, "base64");
  return JSON.parse(inflate(binary, { to: "string" }));
}

describe("remarkDirectiveBlockflowEditor", () => {
  it("should transform with steps", async () => {
    expect(
      toHtml(
        `
::::blockflow-editor{title="Basic Tutorial" src="./project.sb3"}

:::step{title="Welcome"}
Hello world!
:::

:::step{title="Step 2" image="./step2.png" video="./step2.mp4"}
Do this thing.
:::

::::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should transform without steps", async () => {
    expect(
      toHtml(
        `
::::blockflow-editor{title="My Tutorial" src="./project.sb3"}
::::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
  it("should register directives", async () => {
    expect(
      toHtml(
        `
::::blockflow-editor{title="Test" src="./test.sb3"}

:::step{title="Step 1"}
Content
:::

::::
`,
        ctx,
      ).data.directives?.["blockflow-editor"],
    ).toBeDefined();
  });
  it("should use pako encoding for inline config", async () => {
    const result = toHtml(
      `
::::blockflow-editor{title="Test" src="./test.sb3"}

:::step{title="Step 1"}
Content
:::

::::
`,
      ctx,
    );
    const html = result.value as string;
    const match = html.match(/project=([^"&]*)/);
    expect(match).toBeDefined();
    const decoded = decodeURIComponent(match![1]);
    expect(decoded.startsWith("pako:")).toBe(true);
    const config = decodePako(decoded);
    expect(config.title).toBe("Test");
    expect(config.sb3).toBe("/public/test.sb3");
    expect(config.steps).toHaveLength(1);
    expect(config.steps[0].title).toBe("Step 1");
    expect(config.steps[0].text).toBe("Content");
  });
  it("should not generate files", async () => {
    const result = toHtml(
      `
::::blockflow-editor{title="Test" src="./test.sb3"}

:::step{title="Step 1"}
Content
:::

::::
`,
      ctx,
    );
    expect(result.data.generatedFiles).toBeUndefined();
  });
  it("should support project attribute for json file URL", async () => {
    const result = toHtml(
      `
::::blockflow-editor{project="https://example.com/tutorial.json"}
::::
`,
      ctx,
    );
    const html = result.value as string;
    expect(html).toContain(
      `project=${encodeURIComponent("https://example.com/tutorial.json")}`,
    );
  });
  it("should support ui and toolbox attributes", async () => {
    const result = toHtml(
      `
::::blockflow-editor{title="Tutorial" src="./project.sb3" allowExtensions="false" showCostumesTab="false" showSoundsTab="true" categories="motion,events,control" blocks-motion="motion_movesteps,motion_turnright"}

:::step{title="Step 1"}
Hello
:::

::::
`,
      ctx,
    );
    const html = result.value as string;
    const match = html.match(/project=([^"&]*)/);
    const config = decodePako(decodeURIComponent(match![1]));
    expect(config.ui).toEqual({
      allowExtensions: false,
    });
    expect(config.costumes).toEqual({
      enabled: false,
    });
    expect(config.sounds).toEqual({
      enabled: true,
    });
    expect(config.toolbox.categories).toEqual(["motion", "events", "control"]);
    expect(config.toolbox.blocks).toEqual({
      motion: ["motion_movesteps", "motion_turnright"],
    });
  });
});
