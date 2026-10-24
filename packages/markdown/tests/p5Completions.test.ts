import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
// @ts-ignore: client modules without types
import { P5_VERSION } from "../assets/directive-p5/src/p5-api.js";
// @ts-ignore: client modules without types
import { p5Completions } from "../assets/directive-p5/src/completions.js";

const labels = (options: { label: string }[]) => options.map((o) => o.label);

describe("p5 completions", () => {
  it("are generated from the p5 that is bundled", () => {
    const { version } = JSON.parse(
      fs.readFileSync(path.join("node_modules", "p5", "package.json"), "utf8"),
    );
    // If this fails, run `pnpm p5:completions`.
    expect(P5_VERSION).toBe(version);
  });

  it("offer p5's functions, variables and constants", () => {
    const globals = p5Completions.globals;
    expect(labels(globals)).toEqual(
      expect.arrayContaining([
        "createCanvas",
        "circle",
        "fill",
        "setup",
        "draw",
        "mouseX",
        "width",
        "WEBGL",
      ]),
    );
    const circle = globals.find((o: { label: string }) => o.label === "circle");
    expect(circle).toMatchObject({
      type: "function",
      detail: "circle(x, y, d)",
      info: "Draws a circle.",
    });
    const mouseX = globals.find((o: { label: string }) => o.label === "mouseX");
    expect(mouseX.type).toBe("variable");
    expect(mouseX.detail).toBeUndefined();
  });

  it("complete a vector's members after its dot", () => {
    expect(labels(p5Completions.members)).toEqual(
      expect.arrayContaining(["add", "mag", "normalize", "x", "y"]),
    );
    expect(
      p5Completions.memberBases(
        "let v = createVector(1, 2);\nthis.pos = createVector(0, 0);\nlet w = p5.Vector.add(v, v);\nlet n = 5;",
      ),
    ).toEqual(["v", "pos", "w"]);
  });
});
