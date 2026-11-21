import { describe, expect, it } from "vitest";
import { ctx } from "./mock";
import { process } from "../src/process";
import { storedElements } from "../src/storedElements";

describe("storedElements", () => {
  it("lists the elements that keep a reader's work, in page order", async () => {
    const result = await process(
      [
        `::textinput{placeholder="First"}`,
        ``,
        `:::tabs`,
        `::::tab{title="A"}`,
        `Text`,
        `::::`,
        `:::`,
        ``,
        `::textinput{id="named" placeholder="Second"}`,
        ``,
        "````md",
        "```",
        "````",
        ``,
        `::struktolab{id="sl"}`,
        ``,
      ].join("\n"),
      ctx,
    );
    const html = String(result.value);
    const first = html.match(/class="directive-textinput" data-id="([^"]+)"/)![1];

    expect(storedElements(result)).toEqual([
      { id: first, name: "textinput", table: "textinput" },
      // An id the author gave counts too.
      { id: "named", name: "textinput", table: "textinput" },
      { id: "sl", name: "struktolab", table: "struktolab" },
    ]);
  });

  it("says how the IDEs' rows are keyed", async () => {
    const result = await process(
      [
        `::excalidraw{id="ex"}`,
        ``,
        `:::webide{id="web"}`,
        "```html",
        "<p>Hi</p>",
        "```",
        `:::`,
        ``,
        `:::onlineide{id="java"}`,
        "```java",
        "System.out.println(1);",
        "```",
        `:::`,
        ``,
        `:::sqlide{id="sql"}`,
        "```sql",
        "SELECT 1;",
        "```",
        `:::`,
        ``,
      ].join("\n"),
      ctx,
    );
    expect(storedElements(result)).toEqual([
      { id: "ex", name: "excalidraw", table: "excalidraw" },
      { id: "web", name: "webide", table: "ide" },
      { id: "java", name: "onlineide", table: "onlineide", match: "prefix" },
      {
        id: "sql",
        name: "sqlide",
        table: "sqlideScripts",
        match: "prefix",
        also: [{ table: "sqlideDatabases", match: "suffix" }],
      },
    ]);
  });

  it("lists checklist items and ABC editors", async () => {
    const result = await process(
      ["- [ ] Read the page", "- [x] Try the example", "", "```abcjs editor", "X:1", "K:C", "CDEF|", "```", ""].join("\n"),
      ctx,
    );
    const html = String(result.value);
    const items = [...html.matchAll(/data-checklist-id="([^"]+)"/g)].map((m) => m[1]);
    const abc = html.match(/class="directive-abc-music"[^>]*data-id="([^"]+)"/)![1];
    expect(storedElements(result)).toEqual([
      { id: `:${items[0]}`, name: "checklist", table: "checklist", match: "suffix" },
      { id: `:${items[1]}`, name: "checklist", table: "checklist", match: "suffix" },
      { id: abc, name: "abc-music", table: "abcMusic" },
    ]);
  });

  it("gives ABC editors their own ids, but not plain tunes", async () => {
    const result = await process(
      ["```abcjs editor", "X:1", "CDEF|", "```", "", "```abcjs editor", "X:2", "GABc|", "```", "", "```abcjs", "X:3", "C|", "```", ""].join("\n"),
      ctx,
    );
    const ids = [...String(result.value).matchAll(/class="directive-abc-music"[^>]*?(?:data-id="([^"]+)")?>/g)].map((m) => m[1]);
    expect(ids).toHaveLength(3);
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
    expect(ids[2]).toBeUndefined();
  });

  it("is empty for a page without such elements", async () => {
    expect(storedElements(await process(`# Just text\n`, ctx))).toEqual([]);
  });
});
