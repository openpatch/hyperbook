import { HyperbookContext } from "@hyperbook/types";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkDirectiveOpenscad from "../src/remarkDirectiveOpenscad";
import { ctx } from "./mock";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveOpenscad(ctx),
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

describe("remarkDirectiveOpenscad", () => {
  it("should transform basic openscad", async () => {
    expect(
      toHtml(
        `:::openscad

\`\`\`scad
cube([20,20,20], center=true);
\`\`\`

:::

`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform openscad with binary file directives", async () => {
    expect(
      toHtml(
        `:::openscad

@file dest="/input/model.stl" src="models/model.stl"

\`\`\`scad
import("/input/model.stl");
\`\`\`

:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
});
