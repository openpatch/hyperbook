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

  it("should map @file directives to the data-type of their file kind", async () => {
    const html = toHtml(
      `:::onlineide

@file dest="/waves.frag" src="shaders/waves.frag"
@file dest="/default.vert" src="shaders/default.vert"
@file dest="/level.json" src="data/level.json"
@file dest="/sky.jpg" src="images/sky.jpg"

\`\`\`java
new Stage();
\`\`\`

:::
`,
      ctx,
    ).value as string;
    expect(html).toContain(
      '<script type="text/plain" title="/waves.frag" data-type="asset" src="/public/shaders/waves.frag"></script>',
    );
    expect(html).toContain(
      '<script type="text/plain" title="/default.vert" data-type="asset" src="/public/shaders/default.vert"></script>',
    );
    expect(html).toContain(
      '<script type="text/plain" title="/level.json" data-type="java" src="/public/data/level.json"></script>',
    );
    expect(html).toContain(
      '<script type="text/plain" title="/sky.jpg" data-type="image" src="/public/images/sky.jpg"></script>',
    );
  });

  it("should pass the width of the output panel on", async () => {
    const html = toHtml(
      `:::onlineide{outputWidth="60%" libraries="scratch"}

\`\`\`java
new Stage();
\`\`\`

:::
`,
      ctx,
    ).value as string;
    expect(html).toContain("'outputWidth': '60%'");
  });

  it("should transform online-ide with ::file directives", async () => {
    expect(
      toHtml(
        `:::onlineide

::file{path="/input/sky.jpg" src="images/sky.jpg"}

\`\`\`java
Bitmap sky = new Bitmap("/input/sky.jpg");
\`\`\`

:::
`,
        ctx,
      ).value,
    ).toMatchSnapshot();
  });

  it("should map ::file directives to the data-type of their file kind", async () => {
    const html = toHtml(
      `:::onlineide

::file{path="waves.frag" src="shaders/waves.frag"}
::file{path="/sky.jpg" src="images/sky.jpg"}

\`\`\`java
new Stage();
\`\`\`

:::
`,
      ctx,
    ).value as string;
    expect(html).toContain(
      '<script type="text/plain" title="waves.frag" data-type="asset" src="/public/shaders/waves.frag"></script>',
    );
    expect(html).toContain(
      '<script type="text/plain" title="/sky.jpg" data-type="image" src="/public/images/sky.jpg"></script>',
    );
  });

  it("should name a ::file without path after its source", async () => {
    const html = toHtml(
      `:::onlineide

::file{src="images/sky.jpg"}

\`\`\`java
new Stage();
\`\`\`

:::
`,
      ctx,
    ).value as string;
    expect(html).toContain('title="sky.jpg"');
  });

  it("should report a ::file without src", async () => {
    const result = toHtml(
      `:::onlineide

::file{path="sky.jpg"}

\`\`\`java
new Stage();
\`\`\`

:::
`,
      ctx,
    );
    expect(result.messages.map((m) => m.reason).join("\n")).toContain(
      '::file in the onlineide directive needs a src="…".',
    );
  });

  it("should leave the output panel alone without outputWidth", async () => {
    const html = toHtml(
      `:::onlineide

\`\`\`java
new Stage();
\`\`\`

:::
`,
      ctx,
    ).value as string;
    expect(html).not.toContain("outputWidth");
  });

  it("should start relative asset paths from the page's folder", async () => {
    const html = toHtml(
      `:::onlineide{libraries="scratch"}

\`\`\`java
new Stage();
\`\`\`

:::
`,
      ctx,
    ).value as string;
    expect(html).toMatch(/'assetBaseUrl': '[^']*\/'/);
  });
});
