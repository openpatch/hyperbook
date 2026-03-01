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
  it("should generate files", async () => {
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
    const generatedFiles = result.data.generatedFiles as any[];
    expect(generatedFiles).toBeDefined();
    expect(generatedFiles).toHaveLength(1);
    expect(generatedFiles[0].directive).toBe("blockflow-editor");
    expect(generatedFiles[0].filename).toMatch(/\.json$/);
    const config = JSON.parse(generatedFiles[0].content);
    expect(config.title).toBe("Test");
    expect(config.sb3).toBe("./test.sb3");
    expect(config.steps).toHaveLength(1);
    expect(config.steps[0].title).toBe("Step 1");
    expect(config.steps[0].text).toBe("Content");
  });
  it("should support ui and toolbox attributes", async () => {
    const result = toHtml(
      `
::::blockflow-editor{title="Tutorial" src="./project.sb3" allowExtensions="false" categories="motion,events,control" blocks-motion="motion_movesteps,motion_turnright"}

:::step{title="Step 1"}
Hello
:::

::::
`,
      ctx,
    );
    const generatedFiles = result.data.generatedFiles as any[];
    const config = JSON.parse(generatedFiles[0].content);
    expect(config.ui).toEqual({ allowExtensions: false });
    expect(config.toolbox.categories).toEqual(["motion", "events", "control"]);
    expect(config.toolbox.blocks).toEqual({
      motion: ["motion_movesteps", "motion_turnright"],
    });
  });
});
