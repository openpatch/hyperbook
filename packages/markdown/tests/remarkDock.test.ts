import { HyperbookContext } from "@hyperbook/types/dist";
import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkToRehype from "remark-rehype";
import { unified, PluggableList } from "unified";
import remarkDirective from "remark-directive";
import remarkDirectiveRehype from "remark-directive-rehype";
import { ctx } from "./mock";
import remarkDirectiveTextinput from "../src/remarkDirectiveTextinput";
import remarkDock from "../src/remarkDock";
import remarkParse from "../src/remarkParse";
import { i18n } from "../src/i18n";

const toHtml = (md: string, ctx: HyperbookContext) => {
  const remarkPlugins: PluggableList = [
    remarkDirective,
    remarkDirectiveRehype,
    remarkDirectiveTextinput(ctx),
    remarkDock(ctx),
  ];

  return unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(remarkToRehype)
    .use(rehypeStringify)
    .processSync(md);
};

describe("remarkDock", () => {
  i18n.init("en");

  it("leaves an element undockable by default", () => {
    const result = toHtml("::textinput", ctx);
    expect(result.value).not.toContain("data-dock");
    expect(result.data.js ?? []).not.toContainEqual(["dock.js"]);
  });

  it("marks an element with dock and names the tab after its kind", () => {
    const result = toHtml("::textinput{dock}", ctx);
    expect(result.value).toContain('data-dock="textinput"');
    expect(result.value).toContain('data-dock-label="Notes"');
    expect(result.data.js).toContainEqual(["dock.js"]);
    expect(result.data.css).toContainEqual(["dock.css"]);
  });

  it("takes the tab's label from dock", () => {
    const result = toHtml('::textinput{dock="My notes"}', ctx);
    expect(result.value).toContain('data-dock-label="My notes"');
  });

  it("treats dock=false as off", () => {
    const result = toHtml("::textinput{dock=false}", ctx);
    expect(result.value).not.toContain("data-dock");
  });

  it("ignores dock on elements that can't be docked", () => {
    const result = toHtml(":::alert{dock}\nHi\n:::", ctx);
    expect(result.value).not.toContain("data-dock");
  });
});
