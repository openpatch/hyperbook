import { describe, expect, it } from "vitest";
import { VFile } from "vfile";
import { ctx } from "./mock";
import { process } from "../src/process";

describe("remarkDirectiveArchive", () => {
  it("should render the download link, with and without include", async () => {
    const withInclude = await process(
      `:archive[Projekt: Spielwerkstatt]{name="spielwerkstatt" include="/book/projekte/spielwerkstatt/assets=assets"}`,
      ctx,
    );
    const withoutInclude = await process(
      `:archive[Projekt: Spielwerkstatt]{name="spielwerkstatt"}`,
      ctx,
    );
    // The include attribute only changes what goes into the zip, never the
    // rendered link.
    expect(withInclude.value).toEqual(withoutInclude.value);
    expect(withInclude.value).toMatchSnapshot();
  });

  it("should collect parsed includes on the vfile, keyed by archive name", async () => {
    const file = new VFile({
      path: "/book/projekte/spielwerkstatt.md",
      value: `:archive[Projekt: Spielwerkstatt]{name="spielwerkstatt" include="/book/projekte/spielwerkstatt/assets=assets,/public/readme.md=docs/README.md"}`,
    });
    const result = await process(file, ctx);

    expect(result.data.archiveIncludes).toEqual({
      spielwerkstatt: [
        {
          src: "/book/projekte/spielwerkstatt/assets",
          dest: "assets",
          source: "/book/projekte/spielwerkstatt.md",
        },
        {
          src: "/public/readme.md",
          dest: "docs/README.md",
          source: "/book/projekte/spielwerkstatt.md",
        },
      ],
    });
  });

  it("should collect includes of several archive directives on one page", async () => {
    const result = await process(
      `
:archive[A]{name="a" include="/public/one.txt=one.txt"}
:archive[B]{name="b" include="/public/two.txt=two.txt,/public/three.txt=three.txt"}
`,
      ctx,
    );

    expect(result.data.archiveIncludes).toEqual({
      a: [
        {
          src: "/public/one.txt",
          dest: "one.txt",
          source: undefined,
        },
      ],
      b: [
        { src: "/public/two.txt", dest: "two.txt", source: undefined },
        { src: "/public/three.txt", dest: "three.txt", source: undefined },
      ],
    });
  });

  it("should normalize src and dest", async () => {
    const result = await process(
      `:archive[A]{name="a" include="/public//one.txt=./docs/one.txt"}`,
      ctx,
    );

    expect(result.data.archiveIncludes).toEqual({
      a: [{ src: "/public/one.txt", dest: "docs/one.txt", source: undefined }],
    });
  });

  it("should fail on a pair without =", async () => {
    await expect(
      process(`:archive[A]{name="a" include="/public/one.txt"}`, ctx),
    ).rejects.toThrow(/src=dest/);
  });

  it("should fail on a src that does not start with a slash", async () => {
    await expect(
      process(`:archive[A]{name="a" include="public/one.txt=one.txt"}`, ctx),
    ).rejects.toThrow(/starts with a slash/);
  });

  it("should fail on a src that leaves the book root", async () => {
    await expect(
      process(
        `:archive[A]{name="a" include="/../../etc/secrets=secrets"}`,
        ctx,
      ),
    ).rejects.toThrow(/inside the book root/);
  });

  it("should fail on an absolute dest", async () => {
    await expect(
      process(`:archive[A]{name="a" include="/public/one.txt=/one.txt"}`, ctx),
    ).rejects.toThrow(/relative path inside the zip/);
  });

  it("should fail on a dest containing ..", async () => {
    await expect(
      process(
        `:archive[A]{name="a" include="/public/one.txt=../one.txt"}`,
        ctx,
      ),
    ).rejects.toThrow(/cannot contain/);
  });

  it("should fail on an empty include", async () => {
    await expect(
      process(`:archive[A]{name="a" include=""}`, ctx),
    ).rejects.toThrow(/empty include/);
  });
});
