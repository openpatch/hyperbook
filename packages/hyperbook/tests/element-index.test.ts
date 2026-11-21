import { afterEach, beforeEach, expect, it } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { Hyperproject } from "@hyperbook/types";
import { runBuildProject } from "../build";

let root: string;
let project: Hyperproject;

const write = async (file: string, text: string) => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
};
const index = () =>
  fs
    .readFile(path.join(root, ".hyperbook", "out", "_hyperbook", "elements.json"), "utf8")
    .then(JSON.parse)
    .catch(() => null);

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-element-index-"));
  project = { name: "Tasks", src: root, type: "book" };
  await write("book/index.md", "---\nname: Start\n---\n\n# Start\n\nNo tasks here.\n");
  await write("book/b-later.md", "---\nname: Later\n---\n\n::textinput{id=\"late\"}\n");
  await write(
    "book/a-first.md",
    "---\nname: First tasks\n---\n\n::textinput{id=\"q1\"}\n\n::struktolab{id=\"s1\"}\n",
  );
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

it("lists each page's elements in the book's order for books with cloud", async () => {
  await write("hyperbook.json", JSON.stringify({ name: "Tasks", cloud: { sameOrigin: true } }));
  await runBuildProject(project, project);
  expect(await index()).toEqual({
    version: 1,
    pages: [
      {
        href: "/a-first",
        title: "First tasks",
        elements: [
          { id: "q1", name: "textinput", table: "textinput" },
          { id: "s1", name: "struktolab", table: "struktolab" },
        ],
      },
      { href: "/b-later", title: "Later", elements: [{ id: "late", name: "textinput", table: "textinput" }] },
    ],
  });
});

it("writes no index for books without cloud", async () => {
  await write("hyperbook.json", JSON.stringify({ name: "Tasks" }));
  await runBuildProject(project, project);
  expect(await index()).toBeNull();
});
