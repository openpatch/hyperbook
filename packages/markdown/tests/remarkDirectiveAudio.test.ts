import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import rehypeFormat from "rehype-format";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveAudio from "../src/remarkDirectiveAudio";
import remarkParse from "../src/remarkParse";

export const toHtml = async (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveAudio(ctx),
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
    .process(md);
};

describe("remarkDirectiveAudio", () => {
  it("should transform", async () => {
    const html = await toHtml(
      `
::audio{src="/Free_Test_Data_1MB_MP3.mp3" thumbnail="/group-people.png" title="Hallo" author="Max Mustermann" position="right"}
`,
      ctx,
    );
    expect(html.value).toMatchSnapshot();
  });
  it("should register directives", async () => {
    const processed = await toHtml(
      `
::audio{src="/Free_Test_Data_1MB_MP3.mp3" thumbnail="/group-people.png" title="Hallo" author="Max Mustermann" position="right"}
`,
      ctx,
    );
    expect(processed.data.directives?.["audio"]).toBeDefined();
  });

  it("should transform with content", async () => {
    const processed = await toHtml(
      `
:::audio{src="/lesson.mp3" language="de"}
Das ist eine Funktion $f(x) = x^2$<!-- f von x gleich x Quadrat -->.

$$
\\begin{align}
f(x) &= ax^2 + bx + c
\\end{align}
$$
<!-- Diese Gleichung zeigt die allgemeine Form einer quadratischen Funktion -->

![Diagram](/graph.png)<!-- Das Diagramm zeigt den Verlauf der Funktion -->
:::
`,
      ctx,
    );
    expect(processed.value).toMatchSnapshot();
  });
});
