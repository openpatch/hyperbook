import { describe, expect, it } from "vitest";
import { commitRuns, type HistoryCommit } from "../src/web/pages/editor/history-panel";

const at = (sha: string, email: string, minute: number, tags?: string[]): HistoryCommit => ({
  sha,
  name: email,
  email,
  date: new Date(Date.UTC(2026, 10, 12, 10, minute)).toISOString(),
  message: sha,
  additions: 1,
  deletions: 0,
  tags,
});

const shas = (runs: HistoryCommit[][]) => runs.map((run) => run.map((c) => c.sha));

describe("runs of saves in the History pane", () => {
  it("joins one person's saves minutes apart, newest first", () => {
    expect(shas(commitRuns([at("c", "a", 50), at("b", "a", 30), at("a", "a", 5)]))).toEqual([["c", "b", "a"]]);
  });

  it("splits at a long pause and at another person", () => {
    expect(
      shas(commitRuns([at("d", "a", 59), at("c", "b", 58), at("b", "a", 57), at("a", "a", 0)], 30 * 60_000)),
    ).toEqual([["d"], ["c"], ["b"], ["a"]]);
  });

  it("starts a run at a published commit, so the pane can mark it", () => {
    expect(shas(commitRuns([at("c", "a", 3), at("b", "a", 2, ["published"]), at("a", "a", 1)]))).toEqual([
      ["c"],
      ["b", "a"],
    ]);
  });
});
