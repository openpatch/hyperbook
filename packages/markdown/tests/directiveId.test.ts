import { describe, expect, it } from "vitest";
import { ctx } from "./mock";
import { process } from "../src/process";

/** Pulls the `data-id` of every textinput out of the rendered HTML. */
const idsOf = (html: string): string[] =>
  [...html.matchAll(/class="directive-textinput" data-id="([^"]+)"/g)].map(
    (m) => m[1],
  );

const legacyMapOf = (html: string): Record<string, string> => {
  const match = html.match(
    /<script type="application\/json" id="hyperbook-legacy-ids">([\s\S]*?)<\/script>/,
  );
  return match ? JSON.parse(match[1]) : {};
};

describe("directive ids", () => {
  it("keeps a directive's id when content is added above it", async () => {
    const before = await process(`::textinput{placeholder="Answer"}\n`, ctx);
    const after = await process(
      `Some new introductory prose the author added later.\n\n` +
        `## And a heading\n\n` +
        `::textinput{placeholder="Answer"}\n`,
      ctx,
    );

    const [beforeId] = idsOf(String(before.value));
    const [afterId] = idsOf(String(after.value));

    expect(beforeId).toBeTruthy();
    expect(afterId).toBe(beforeId);
  });

  it("keeps a directive's id when a sibling directive changes", async () => {
    const before = await process(
      `::textinput{placeholder="First"}\n\n::textinput{placeholder="Second"}\n`,
      ctx,
    );
    const after = await process(
      `::textinput{placeholder="First, reworded"}\n\n::textinput{placeholder="Second"}\n`,
      ctx,
    );

    expect(idsOf(String(after.value))[1]).toBe(idsOf(String(before.value))[1]);
  });

  it("gives identical directives on one page distinct ids", async () => {
    const result = await process(`::textinput\n\n::textinput\n\n::textinput\n`, ctx);
    const ids = idsOf(String(result.value));

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it("still honours an explicit id", async () => {
    const result = await process(`::textinput{id="answer-1"}\n`, ctx);
    expect(idsOf(String(result.value))).toEqual(["answer-1"]);
  });

  it("publishes a legacy id map so saved reader data can be migrated", async () => {
    const result = await process(`::textinput{placeholder="Answer"}\n`, ctx);
    const html = String(result.value);
    const [id] = idsOf(html);
    const map = legacyMapOf(html);

    expect(Object.keys(map)).toContain(id);
    // The old id was position-dependent, so it differs from the new one.
    expect(map[id]).not.toBe(id);
  });

  it("does not publish a legacy map when ids are author-supplied", async () => {
    const result = await process(`::textinput{id="answer-1"}\n`, ctx);
    expect(legacyMapOf(String(result.value))).toEqual({});
  });
});
