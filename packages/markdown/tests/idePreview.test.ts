import { describe, expect, it } from "vitest";
import {
  parseObj,
  parseStl,
  previewKind,
  // @ts-expect-error The browser bundle is JavaScript.
} from "../ide-bundle/preview.js";

/** A binary STL with the given triangles (9 numbers each). */
const binaryStl = (triangles: number[][]) => {
  const buffer = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triangles.length, true);
  triangles.forEach((tri, i) => {
    tri.forEach((value, j) =>
      view.setFloat32(84 + i * 50 + 12 + j * 4, value, true),
    );
  });
  return buffer;
};

describe("previewKind", () => {
  it.each([
    ["logo.PNG", "image"],
    ["sound/beep.mp3", "audio"],
    ["clip.webm", "video"],
    ["sheet.pdf", "pdf"],
    ["Fira.woff2", "font"],
    ["part.stl", "model"],
    ["part.obj", "model"],
    ["data.bin", "other"],
    ["Makefile", "other"],
  ])("%s → %s", (path: string, kind: string) => {
    expect(previewKind(path)).toBe(kind);
  });
});

describe("parseStl", () => {
  it("reads binary STL", () => {
    const triangles = parseStl(binaryStl([[0, 0, 0, 1, 0, 0, 0, 1, 0]]));
    expect(Array.from(triangles)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });

  it("reads ASCII STL", () => {
    const text = `solid t
facet normal 0 0 1
  outer loop
    vertex 0 0 0
    vertex 1 0 0
    vertex 0 1.5 -2e1
  endloop
endfacet
endsolid t
`;
    const triangles = parseStl(new TextEncoder().encode(text).buffer);
    expect(Array.from(triangles)).toEqual([0, 0, 0, 1, 0, 0, 0, 1.5, -20]);
  });

  it("does not take an ASCII file that starts with solid for binary", () => {
    // 84 + 50n bytes by coincidence is not enough to be binary: the count at
    // byte 80 has to match the size.
    const text = "solid " + "x".repeat(200);
    expect(parseStl(new TextEncoder().encode(text).buffer)).toHaveLength(0);
  });
});

describe("parseObj", () => {
  it("splits polygons into triangles and accepts v/vt/vn indices", () => {
    const text = `v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
f 1/1/1 2/2/1 3/3/1 4/4/1
`;
    expect(Array.from(parseObj(text))).toEqual([
      0, 0, 0, 1, 0, 0, 1, 1, 0,
      0, 0, 0, 1, 1, 0, 0, 1, 0,
    ]);
  });

  it("resolves negative indices from the end", () => {
    const text = "v 0 0 0\nv 1 0 0\nv 0 1 0\nf -3 -2 -1\n";
    expect(Array.from(parseObj(text))).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });
});
