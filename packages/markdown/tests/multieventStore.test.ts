import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { ctx } from "./mock";
import { process } from "../src/process";
import { storedElements } from "../src/storedElements";

const source = readFileSync(path.join(__dirname, "../assets/directive-multievent/multievent.js"), "utf8");

/** multievent.js on a page with these elements (data-id or none), over a real Dexie store. */
async function page(ids: (string | null)[]) {
  const db = new Dexie(`multievent-${Math.random()}`);
  db.version(1).stores({ multievent: "id" });
  await db.open();
  const elements = ids.map((id) => ({
    getAttribute: (name: string) => (name === "data-id" ? id : null),
    getElementsByClassName: () => [],
  }));
  const context = vm.createContext({
    window: { addEventListener() {}, location: { pathname: "/chapter" } },
    document: {
      getElementsByClassName: (name: string) => (name === "multievent" ? elements : []),
      getElementById: () => null,
    },
    hyperbook: { store: { db } },
    console: { error() {}, log() {} },
  });
  vm.runInContext(source, context);
  return { db, multievent: vm.runInContext("multievent", context) };
}

describe("multievent's saved state", () => {
  it("is keyed by the directive id", async () => {
    const { db, multievent } = await page(["task-a", "task-b"]);
    expect(multievent.storeKey(1)).toBe("task-b");
    await db.table("multievent").put({ id: "task-b", state: "{}" });
    expect(await db.table("multievent").get("task-b")).toBeTruthy();
  });

  it("moves a save from the old position key to the id, once", async () => {
    const { db, multievent } = await page(["task-a", "task-b"]);
    await db.table("multievent").put({ id: "multievent_1_/chapter", state: '{"vNr":3}' });
    await multievent.loadState(1);
    expect(await db.table("multievent").get("task-b")).toEqual({ id: "task-b", state: '{"vNr":3}' });
    expect(await db.table("multievent").get("multievent_1_/chapter")).toBeUndefined();
  });

  it("keeps the old key on pages built before the id", async () => {
    const { multievent } = await page([null]);
    expect(multievent.storeKey(0)).toBe("multievent_0_/chapter");
  });
});

describe("the multievent directive", () => {
  it("renders its id and lists it in the page's elements", async () => {
    const result = await process(`:::multievent{id="quiz"}\nText\n:::\n`, ctx);
    expect(String(result.value)).toContain('data-id="quiz"');
    expect(storedElements(result)).toEqual([{ id: "quiz", name: "multievent", table: "multievent" }]);
  });
});
