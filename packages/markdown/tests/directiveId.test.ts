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

describe("identical directives", () => {
  /** The form-check messages are noise here; only the id warning matters. */
  const idWarnings = async (source: string) => {
    const file = await process(source, ctx);
    return file.messages
      .map((m) => String(m.reason))
      .filter((r) => r.includes("have to share a generated id"));
  };

  it("warns when two identical directives must share a generated id", async () => {
    // Their ids differ only by a suffix that depends on the other still
    // colliding, so editing one can move a reader's answer into the other.
    const warnings = await idWarnings("::textinput\n\n::textinput\n");
    expect(warnings).toHaveLength(1);
    // The message has to say what to do about it.
    expect(warnings[0]).toContain('id="textinput-1"');
  });

  it("warns once per group, not once per repeat", async () => {
    expect(
      await idWarnings("::textinput\n\n::textinput\n\n::textinput\n"),
    ).toHaveLength(1);
  });

  it("stays quiet when the directives differ", async () => {
    expect(
      await idWarnings('::textinput{placeholder="A"}\n\n::textinput{placeholder="B"}\n'),
    ).toEqual([]);
  });

  it("stays quiet when the author pinned ids", async () => {
    expect(
      await idWarnings('::textinput{id="a"}\n\n::textinput{id="b"}\n'),
    ).toEqual([]);
  });
});
