import path from "path";
import { describe, it, expect } from "vitest";
import * as vfile from "../src/vfile";

describe("list", () => {
  const relative = (s: string) =>
    path.relative(path.join(__dirname, "fixtures"), s);
  it("should list all", async () => {
    let hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    const files = await vfile.list(hyperbookPath);
    expect(
      files.map((f) => ({
        ...f,
        root: relative(f.root),
        path: { ...f.path, absolute: relative(f.path.absolute) },
      }))
    ).toMatchSnapshot();
  });

  it("should list for folder book", async () => {
    let hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    const files = await vfile.listForFolder(hyperbookPath, "book");
    expect(
      files.map((f) => ({
        ...f,
        root: relative(f.root),
        path: { ...f.path, absolute: relative(f.path.absolute) },
      }))
    ).toMatchSnapshot();
  });

  it("should include main index", async () => {
    let hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    const files = await vfile.listForFolder(hyperbookPath, "book");
    const file = files.find((f) => f.path.href === "/");
    expect(file).toBeDefined();
  });
});

describe("getMarkdown", () => {
  it("should get markdown from template", async () => {
    let hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    let files = await vfile.list(hyperbookPath);
    let templateFile = files.find(
      (f) => f.name === "use-template1" && f.folder === "book"
    );
    if (!templateFile) {
      throw Error("Template not found");
    }

    expect(await vfile.getMarkdown(templateFile)).toMatchSnapshot();
  });
});

describe("getDirectory", () => {
  it("should include main index", async () => {
    let hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    let directory = await vfile.getDirectory(hyperbookPath, "book");
    expect(directory.index).toBeDefined();
  });
});

describe("extractLines", () => {
  const text =
    "Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10";
  it("should extract lines by range", () => {
    const extractedLines = vfile.extractLines(text, "2-4", "...");
    expect(extractedLines).toMatchSnapshot();
  });
  it("should extract lines with gaps", () => {
    const extractedLines = vfile.extractLines(text, "1,4-6,8", "...");
    expect(extractedLines).toMatchSnapshot();
  });
  it("should extract lines with no ellipsis", () => {
    const extractedLines = vfile.extractLines(text, "1,4-6,8");
    expect(extractedLines).toMatchSnapshot();
  });
  it("should extract lines with custom ellipsis", () => {
    const extractedLines = vfile.extractLines(text, "1,4-6,8", "// ...");
    expect(extractedLines).toMatchSnapshot();
  });
  it("should extract lines and not add ellipsis on first and last line", () => {
    const extractedLines = vfile.extractLines(text, "1,4-6,10", "// ...");
    expect(extractedLines).toMatchSnapshot();
  });
  it("should return full content", () => {
    const extractedLines = vfile.extractLines(text);
    expect(extractedLines).toMatchSnapshot();
  });
  it("should extract lines matching a regex", () => {
    const source = `
import org.openpatch.scratch.Sprite;
import org.openpatch.scratch.Stage;
import org.openpatch.scratch.extensions.GifRecorder;

public class SpriteGetCurrentCostumeIndex {
    public SpriteGetCurrentCostumeIndex() {
        Stage myStage = new Stage(256, 100);
        Sprite mySprite = new Sprite("zeta", "examples/java/assets/zeta_green_badge.png");
        mySprite.addCostume("gamma", "examples/java/assets/gamma_purple_badge.png");
        mySprite.changeY(20);
        myStage.add(mySprite);
        mySprite.think("Index: " + mySprite.getCurrentCostumeIndex());
        GifRecorder recorder = new GifRecorder("examples/java/" + this.getClass().getName() + ".gif");
        recorder.start();

        myStage.wait(2000);
        mySprite.nextCostume();
        mySprite.think("Index: " + mySprite.getCurrentCostumeIndex());
        myStage.wait(2000);

        recorder.stop();
        System.exit(0);
    }

    public static void main(String[] args) {
        new SpriteGetCurrentCostumeIndex();
    }
}
`;
    const extracted = `
import org.openpatch.scratch.Sprite;
import org.openpatch.scratch.Stage;

public class SpriteGetCurrentCostumeIndex {
    public SpriteGetCurrentCostumeIndex() {
        Stage myStage = new Stage(256, 100);
        Sprite mySprite = new Sprite("zeta", "examples/java/assets/zeta_green_badge.png");
        mySprite.addCostume("gamma", "examples/java/assets/gamma_purple_badge.png");
        mySprite.changeY(20);
        myStage.add(mySprite);
        mySprite.think("Index: " + mySprite.getCurrentCostumeIndex());

        myStage.wait(2000);
        mySprite.nextCostume();
        mySprite.think("Index: " + mySprite.getCurrentCostumeIndex());
        myStage.wait(2000);

        System.exit(0);
    }

    public static void main(String[] args) {
        new SpriteGetCurrentCostumeIndex();
    }
}
`;
    const result = vfile.extractLines(source, "reg:[Rr]ecorder");
    expect(result).toEqual(extracted);
  });
});
