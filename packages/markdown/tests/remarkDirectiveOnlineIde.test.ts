import { HyperbookContext } from "@hyperbook/types";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import remarkDirectiveOnlineIde from "../src/remarkDirectiveOnlineIde";
import { ctx } from "./mock";
import remarkParse from "../src/remarkParse";

export const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveOnlineIde(ctx),
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

describe("remarkDirectiveOnlineIde", () => {
  it("should transform basic online-ide", async () => {
    expect(
      toHtml(
        `:::onlineide

\`\`\`java
public class Main {
  public static void main(String[] args) {
    System.out.println("Hello World");
  }
}
\`\`\`

:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform online-ide with @file directives", async () => {
    expect(
      toHtml(
        `:::onlineide

@file dest="/input/sky.jpg" src="images/sky.jpg"

\`\`\`java
Bitmap sky = new Bitmap("/input/sky.jpg");
\`\`\`

:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should transform online-ide with multiple @file directives", async () => {
    expect(
      toHtml(
        `:::onlineide

@file dest="/input/image1.jpg" src="images/image1.jpg"
@file dest="/input/image2.jpg" src="images/image2.jpg"

\`\`\`java
Bitmap img1 = new Bitmap("/input/image1.jpg");
Bitmap img2 = new Bitmap("/input/image2.jpg");
\`\`\`

:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });
});
