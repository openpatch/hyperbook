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

  it("is empty for a page without such elements", async () => {
    expect(storedElements(await process(`# Just text\n`, ctx))).toEqual([]);
  });
});
