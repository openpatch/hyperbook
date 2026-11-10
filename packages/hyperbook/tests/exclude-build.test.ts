import { afterEach, beforeEach, expect, it } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { Hyperproject } from "@hyperbook/types";
import { runBuildProject } from "../build";
import { checkBook } from "../check";

let root: string;
let project: Hyperproject;

const write = async (file: string, text = "x") => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
};

const built = (file: string) =>
  fs
    .stat(path.join(root, ".hyperbook", "out", file))
    .then(() => true)
    .catch(() => false);

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-exclude-build-"));
  project = { name: "Exclude", src: root, type: "book" };
  await write("book/index.md", "# Hello\n\n[Exam](/intern/exam.pdf)\n");
  await write("book/sheet.pdf");
  await write("book/intern/exam.pdf");
  await write("public/logo.txt");
  await write("public/notes.draft.txt");
  await write("glossary/term.md", "# Term\n");
  await write("glossary/intern.draft.txt");
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

it("copies every file without the setting", async () => {
  await write("hyperbook.json", JSON.stringify({ name: "Exclude" }));
  await runBuildProject(project, project);
  expect(await built("sheet.pdf")).toBe(true);
  expect(await built("intern/exam.pdf")).toBe(true);
  expect(await built("notes.draft.txt")).toBe(true);
  expect(await built("glossary/intern.draft.txt")).toBe(true);
});

it("keeps excluded files out of the site", async () => {
  await write(
    "hyperbook.json",
    JSON.stringify({ name: "Exclude", exclude: ["intern/**", "**/*.draft.*"] }),
  );
  await runBuildProject(project, project);
  expect(await built("index.html")).toBe(true);
  expect(await built("sheet.pdf")).toBe(true);
  expect(await built("logo.txt")).toBe(true);
  expect(await built("intern/exam.pdf")).toBe(false);
  expect(await built("notes.draft.txt")).toBe(false);
  expect(await built("glossary/intern.draft.txt")).toBe(false);
});

it("reports a link to an excluded file", async () => {
  await write(
    "hyperbook.json",
    JSON.stringify({ name: "Exclude", exclude: ["intern/**"] }),
  );
  const findings = await checkBook(project);
  expect(JSON.stringify(findings)).toContain("/intern/exam.pdf");
});

it("reports a link to a Typst source that is not offered for download", async () => {
  await write("hyperbook.json", JSON.stringify({ name: "Exclude" }));
  await write("book/blatt.typ", "= Blatt");
  await write("book/vorlage.typ", "= Vorlage");
  await write(
    "book/typst.md",
    '# Typst\n\n[Blatt](/blatt.typ) [Vorlage](/vorlage.typ)\n\n:download[Vorlage]{src="/vorlage.typ"}\n',
  );
  const findings = await checkBook(project);
  const reasons = findings.map((f) => f.reason).filter((r) => r.includes(".typ"));
  expect(reasons).toEqual([expect.stringContaining("Typst source, which is not published: /blatt.typ")]);
});
