import { describe, expect, it } from "vitest";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkToRehype from "remark-rehype";
import { unified } from "unified";
import remarkChecklist from "../src/remarkChecklist";
import remarkParse from "../src/remarkParse";

const render = (markdown: string) =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkChecklist)
      .use(remarkToRehype)
      .use(rehypeStringify)
      .processSync(markdown),
  );

const ids = (html: string) =>
  [...html.matchAll(/data-checklist-id="([^"]+)"/g)].map((match) => match[1]);

describe("Markdown checklist ids", () => {
  it("adds a storage id only to task-list items", () => {
    const html = render("- [ ] First\n- A regular item\n- [x] Last");

    expect(ids(html)).toHaveLength(2);
    expect(html).toContain('class="task-list-item"');
  });

  it("keeps an item's id when its authored checked state changes", () => {
    expect(ids(render("- [ ] Same task"))).toEqual(
      ids(render("- [x] Same task")),
    );
  });

  it("disambiguates identical tasks", () => {
    const [first, second] = ids(render("- [ ] Same task\n- [ ] Same task"));

    expect(second).toBe(`${first}-2`);
  });
});
