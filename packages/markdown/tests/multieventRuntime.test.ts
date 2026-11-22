// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import Dexie from "dexie";
import { beforeEach, describe, expect, it } from "vitest";
import { ctx } from "./mock";
import { process } from "../src/process";

const source = readFileSync(
  path.join(__dirname, "../assets/directive-multievent/multievent.js"),
  "utf8",
);

/**
 * A page with `markdown`'s multievent blocks, built like a real one and
 * running multievent.js over a real DOM — with the store over
 * fake-indexeddb and MathLive/Compute-Engine stubbed.
 */
async function page(markdown: string) {
  const result = await process(markdown, ctx);
  const whole = String(result.value);
  // Only the multievents go into the DOM; the page's shell is not under test.
  const bodyMarkup = Array.from(
    whole.matchAll(
      /<div class="directive-multievent[\s\S]*?<\/div>\n(?=\s*<\/div>|\s*<)/g,
    ),
  ).join("\n");
  document.body.innerHTML = bodyMarkup || whole;

  const db = new Dexie(`multievent-runtime-${Math.random()}`);
  db.version(1).stores({ multievent: "id" });
  await db.open();

  window.location.pathname = "/chapter";
  const context = vm.createContext({
    document,
    window,
    Intl,
    console: { warn() {}, error() {}, log() {} },
    hyperbook: { store: { db } },
  });
  vm.runInContext(source, context);
  const multievent = vm.runInContext("multievent", context);

  multievent.init();
  // init kicks off los() per multievent; those are asynchronous only in
  // reading saved state, so the DOM is built after a tick.
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  return { db, multievent };
}

const answer = (correct: boolean) => ({
  isValid: true,
  isEqual: () => correct,
  N: () => ({ re: correct ? 1 : 2 }),
});

describe("multievent.js over compiled pages", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("builds the radios of a group with position-dependent names", async () => {
    await page(
      `:::multievent\n{r1{Leopard}} {r1{!Cheetah}} {r1{Gazelle}}\n:::\n`,
    );
    const radios = Array.from(
      document.querySelectorAll<HTMLInputElement>("input.MERadio"),
    );
    expect(radios).toHaveLength(3);
    // same group; one correct
    expect(radios.map((r) => r.getAttribute("name"))).toEqual([
      "radio01",
      "radio01",
      "radio01",
    ]);
    expect(radios.map((r) => r.value)).toEqual(["0", "1", "0"]);
    // label wiring
    expect(radios[1].id).toBeTruthy();
    const label = document.querySelector(
      `label[for="${radios[1].id}"]`,
    ) as HTMLElement | null;
    expect(label?.textContent).toContain("Cheetah");
    // evaluation bar exists
    expect(document.getElementById("MuEvAuswButB0")).toBeTruthy();
  });

  it("marks the fields of a correct round and shows the hint", async () => {
    const { multievent } = await page(
      [
        ":::multievent",
        "The {t{Donkey}} and the {z{4}}",
        "{H{Well done!}} {h{Not yet.}}",
        ":::",
      ].join("\n"),
    );
    const inputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("input.multiEvInp"),
    );
    expect(inputs).toHaveLength(2);
    inputs[0].value = "donkey";
    inputs[1].value = "4";
    await multievent.Auswertung(0);

    expect(inputs[0].disabled).toBe(true); // case-insensitive text field
    expect(inputs[0].style.backgroundColor).not.toBe("");
    const hint = document.querySelector(
      ".Multieventhinweis[data-typ='richtig']",
    ) as HTMLElement;
    expect(hint.style.display).toBe("inline-block");
    // attempt counter
    const versuche1 = document.getElementById("MultieventVersuche0")!;
    expect(versuche1.textContent).toBe("1");
  });

  it("evaluates dropdowns built by the compiler as it evaluated its own", async () => {
    const { multievent } = await page(
      "A {a{Duck|Tit|!Swallow|Pigeon}} does not make a summer.\n".replace(
        /^/,
        ":::multievent\n",
      ) + ":::\n",
    );
    const select = document.querySelector(
      "select.multiEvSel",
    ) as HTMLSelectElement;
    expect(select).toBeTruthy();
    const labels = Array.from(select.options).map((o) => o.text);
    expect(labels).toEqual(["Duck", "Tit", "Swallow", "Pigeon"]);
    const correct = Array.from(select.options).find((o) => o.value === "1")!;
    expect(correct.textContent).toBe("Swallow");
    select.value = "1";
    await multievent.Auswertung(0);
    expect(select.disabled).toBe(true);
    expect(select.style.backgroundColor).not.toBe("");
  });

  it("keeps markers of two multievents in separate groups", async () => {
    await page(
      [
        ":::multievent",
        "{r1{!A}} {r1{B}}",
        ":::",
        "",
        ":::multievent",
        "{r1{!C}} {r1{D}}",
        ":::",
      ].join("\n"),
    );
    const groups = new Set(
      Array.from(
        document.querySelectorAll<HTMLInputElement>("input.MERadio"),
      ).map((r) => r.name),
    );
    expect(groups).toEqual(new Set(["radio01", "radio11"]));
  });

  it("restarts from the original markup when the reader starts over", async () => {
    const { multievent } = await page(
      ":::multievent\n{r1{!A}} {r1{B}}\n:::\n:::multievent\n{r1{!C}}\n:::\n",
    );
    const radio = document.querySelector("input.MERadio") as HTMLInputElement;
    radio.checked = true;
    await multievent.Auswertung(0);
    expect(radio.checked).toBe(true);

    await multievent.los(0);
    const fresh = document.querySelector("input.MERadio") as HTMLInputElement;
    expect(fresh.checked).toBe(false);
    expect(fresh.name).toBe("radio01");
  });

  it("evaluates a math field with the Compute Engine", async () => {
    const { multievent } = await page(
      ":::multievent\nSolve: {m{2x+3|2\\cdot x + 3}}\n:::\n",
    );
    const field = document.querySelector("math-field") as unknown as {
      value: string;
      readOnly: boolean;
      style: Record<string, string>;
    };
    field.value = "3+2x";

    // The engine decides equality here: MathLive and the engine run in the
    // browser only, so a matching engine stands in.
    multievent._matheFeld = Promise.resolve(true);
    multievent._matheEngine = Promise.resolve({
      parse: (latex: string) => answer(latex.includes("x")),
      latexOptions: {},
    });

    await multievent.Auswertung(0);
    expect(field.readOnly).toBe(true);
    expect(field.style.backgroundColor).not.toBe("");
    const versuche1 = document.getElementById("MultieventVersuche0")!;
    expect(versuche1.textContent).toBe("1");
  });

  it("does not evaluate a math field that MathLive never reached", async () => {
    const { multievent } = await page(":::multievent\nSolve: {m{42}}\n:::\n");
    const field = document.querySelector("math-field") as unknown as {
      style: Record<string, string>;
    };
    // no value (MathLive stubbed away): not counted, not marked
    await multievent.Auswertung(0);
    expect(field.style.backgroundColor).toBe("");
  });

  it("splits accepted answers outside braces only", async () => {
    const { multievent } = await page(":::multievent\n{m{1}}\n:::\n");
    expect(multievent.matheAlternativen("\\frac{1}{2}|0.5")).toEqual([
      "\\frac{1}{2}",
      "0.5",
    ]);
    expect(multievent.matheAlternativen("\\{a|b\\}|c")).toEqual([
      "\\{a",
      "b\\}",
      "c",
    ]);
    expect(multievent.matheAlternativen("x_{a|b}")).toEqual(["x_{a|b}"]);
  });

  it("judges each blank of a formula on its own", async () => {
    const { multievent } = await page(
      ":::multievent\n{m{\\placeholder{3}+\\placeholder[b]{4|8}=7}}\n:::\n",
    );
    const field = document.querySelector("math-field") as any;
    expect(field.hasAttribute("readonly")).toBe(true);

    // MathLive's prompt API, standing in for the real field
    const values: Record<string, string> = { blank1: "3", b: "5" };
    const states: Record<string, [string, boolean]> = {};
    field.getPromptValue = (id: string) => values[id];
    field.setPromptState = (id: string, state: string, locked: boolean) => {
      states[id] = [state, locked];
    };
    multievent._matheEngine = Promise.resolve({
      parse: (latex: string) => ({
        isValid: true,
        isEqual: (other: any) => other.latex === latex,
        latex,
        N: () => ({ re: Number.NaN }),
      }),
      latexOptions: {},
    });

    await multievent.Auswertung(0);
    expect(states).toEqual({
      blank1: ["correct", true],
      b: ["incorrect", false],
    });
    expect(field.style.backgroundColor).not.toBe("");
    expect(document.getElementById("MultieventVersuche0")!.textContent).toBe(
      "1",
    );

    values.b = "8";
    await multievent.Auswertung(0);
    expect(states.b).toEqual(["correct", true]);
    expect(field.readOnly).toBe(true);
  });

  it("does not judge blanks before MathLive has arrived", async () => {
    const { multievent } = await page(
      ":::multievent\n{m{x=\\placeholder{2}}}\n:::\n",
    );
    const field = document.querySelector("math-field") as any;
    await multievent.Auswertung(0);
    expect(field.style.backgroundColor).toBe("");
  });

  it("counts one round for two quick clicks", async () => {
    const { multievent } = await page(":::multievent\nSolve: {m{2}}\n:::\n");
    const field = document.querySelector("math-field") as any;
    field.value = "2";
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    multievent._matheEngine = gate.then(() => ({
      parse: () => answer(true),
      latexOptions: {},
    }));

    const first = multievent.Auswertung(0);
    const second = multievent.Auswertung(0);
    release();
    await Promise.all([first, second]);
    // Both clicks came while the engine was loading. Run side by side, both
    // would have passed the "not yet solved" check and counted a round; one
    // after the other, the second sees the round already solved.
    expect(document.getElementById("MultieventVersuche0")!.textContent).toBe(
      "1",
    );
  });
});

