import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTurtleCanvas,
  keysymOf,
  parseSequence,
  tkColor,
  tkFont,
  // @ts-expect-error The browser client is JavaScript.
} from "../assets/directive-pyide/src/turtle-canvas.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("tkColor", () => {
  it("accepts Tk colour names in any case and with spaces", () => {
    expect(tkColor("red")).toBe("#ff0000");
    expect(tkColor("Light Blue")).toBe("#add8e6");
    expect(tkColor("LightBlue")).toBe("#add8e6");
  });

  it("uses Tk 8.6's web colours for gray, green, maroon and purple", () => {
    expect(tkColor("gray")).toBe("#808080");
    expect(tkColor("green")).toBe("#008000");
    expect(tkColor("maroon")).toBe("#800000");
    expect(tkColor("purple")).toBe("#800080");
  });

  it("knows the numbered variants", () => {
    expect(tkColor("SpringGreen2")).toBe("#00ee76");
    expect(tkColor("red4")).toBe("#8b0000");
    expect(tkColor("red5")).toBeUndefined();
  });

  it("computes gray levels like Tk, including its two quirks", () => {
    expect(tkColor("gray0")).toBe("#000000");
    expect(tkColor("grey3")).toBe("#080808");
    expect(tkColor("gray50")).toBe("#7f7f7f");
    expect(tkColor("gray90")).toBe("#e5e5e5");
    expect(tkColor("gray100")).toBe("#ffffff");
    expect(tkColor("gray101")).toBeUndefined();
  });

  it("reads #rgb, #rrggbb, #rrrgggbbb and #rrrrggggbbbb", () => {
    expect(tkColor("#f0a")).toBe("#ff00aa");
    expect(tkColor("#12AB34")).toBe("#12ab34");
    expect(tkColor("#123456789")).toBe("#124578");
    expect(tkColor("#1234abcd5678")).toBe("#12ab56");
    expect(tkColor("#12345")).toBeUndefined();
  });

  it("rejects what Tk rejects and keeps '' as no colour", () => {
    expect(tkColor("rde")).toBeUndefined();
    expect(tkColor("rgb(1, 2, 3)")).toBeUndefined();
    expect(tkColor("")).toBe("");
  });
});

describe("keysymOf", () => {
  it("names keys as Tk does", () => {
    expect(keysymOf({ key: "ArrowUp" })).toBe("Up");
    expect(keysymOf({ key: " " })).toBe("space");
    expect(keysymOf({ key: "Enter" })).toBe("Return");
    expect(keysymOf({ key: "+" })).toBe("plus");
    expect(keysymOf({ key: "a" })).toBe("a");
    expect(keysymOf({ key: "Shift", code: "ShiftRight" })).toBe("Shift_R");
  });
});

describe("parseSequence", () => {
  it("understands the sequences turtle.py binds", () => {
    expect(parseSequence("<Button-1>")).toEqual({ kind: "press", detail: "1" });
    expect(parseSequence("<Button3-ButtonRelease>")).toEqual({
      kind: "release",
      detail: "3",
    });
    expect(parseSequence("<Button1-Motion>")).toEqual({
      kind: "motion",
      detail: "1",
    });
    expect(parseSequence("<KeyPress>")).toEqual({
      kind: "keypress",
      detail: null,
    });
    expect(parseSequence("<KeyRelease-Up>")).toEqual({
      kind: "keyrelease",
      detail: "Up",
    });
    expect(parseSequence("<Enter>")).toBeNull();
  });
});

describe("tkFont", () => {
  it("turns a Tk font into a CSS font", () => {
    expect(tkFont("Arial", 8, "normal").css).toBe('8pt "Arial", sans-serif');
    expect(tkFont("Courier", 12, "bold italic").css).toBe(
      'italic bold 12pt "Courier", monospace',
    );
    expect(tkFont("Times", -20, "underline")).toMatchObject({
      css: '20px "Times", serif',
      underline: true,
    });
  });
});

/** A canvas element whose 2D context accepts and ignores every call. */
const fakeCanvas = () => {
  const context: any = new Proxy(
    { canvas: { width: 1, height: 1 } },
    {
      get: (target: any, name) => (name in target ? target[name] : () => {}),
      set: (target: any, name, value) => {
        target[name] = value;
        return true;
      },
    },
  );
  const element: any = {
    style: {},
    width: 0,
    height: 0,
    getContext: () => context,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  context.canvas = element;
  return element;
};

const browserStubs = () => {
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal("document", { createElement: () => fakeCanvas() });
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) =>
    setTimeout(callback, 0),
  );
  vi.stubGlobal("cancelAnimationFrame", (handle: any) => clearTimeout(handle));
};

const proxy = (fun = () => {}) =>
  Object.assign(vi.fn(fun), { destroy: vi.fn() });

describe("createTurtleCanvas", () => {
  it("answers queries from the model at once", () => {
    const canvas = createTurtleCanvas("t");
    const line = canvas.new_line();
    canvas.draw_line(line, "red", 3, true, 0, 0, 10, -20);
    expect(canvas.coords(line)).toEqual([0, 0, 10, -20]);
    expect(canvas.item_type(line)).toBe("line");
    canvas.delete(line);
    expect(canvas.item_type(line)).toBe("");
    expect(canvas.background()).toBe("white");
    expect(canvas.background("navy")).toBe("navy");
    expect(canvas.window_size()).toEqual([640, 480]);
  });

  it("keeps a program waiting until its animation has played", async () => {
    browserStubs();
    const canvas = createTurtleCanvas("t");
    const element = fakeCanvas();
    canvas.__bindCanvas(element);
    canvas.__resetState(element);

    const line = canvas.new_line();
    canvas.draw_line(line, "black", 1, false, 0, 0, 50, 0);
    canvas.update();
    canvas.delay(30);
    let woken: boolean | undefined;
    const waiting = canvas.drained().then((stopped: boolean) => {
      woken = stopped;
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(woken).toBeUndefined();
    await waiting;
    expect(woken).toBe(false);
    expect(element.style.width).toBe("640px");
  });

  it("wakes a waiting program with true when stopped, until the next run", async () => {
    browserStubs();
    const canvas = createTurtleCanvas("t");
    const element = fakeCanvas();
    canvas.__bindCanvas(element);
    canvas.__resetState(element);

    canvas.delay(10_000);
    const waiting = canvas.drained();
    expect(canvas.__stop()).toBe(true);
    await expect(waiting).resolves.toBe(true);
    await expect(canvas.drained()).resolves.toBe(true);
    expect(canvas.__stop()).toBe(false);

    canvas.__resetState(element);
    await expect(canvas.drained()).resolves.toBe(false);
  });

  it("does not wait without a canvas, as in a test run", async () => {
    const canvas = createTurtleCanvas("t");
    canvas.__resetState(null);
    canvas.delay(10_000);
    await expect(canvas.drained()).resolves.toBe(false);
  });

  it("releases replaced and removed handlers", () => {
    const canvas = createTurtleCanvas("t");
    const first = proxy();
    const second = proxy();
    canvas.bind(-1, "<KeyPress-Up>", first, false);
    expect(canvas.__hasKeyBindings()).toBe(true);
    canvas.bind(-1, "<KeyPress-Up>", second, false);
    expect(first.destroy).toHaveBeenCalled();
    canvas.bind(-1, "<KeyPress-Up>", undefined, false);
    expect(second.destroy).toHaveBeenCalled();
    expect(canvas.__hasKeyBindings()).toBe(false);
  });

  it("counts as busy while a timer is pending, and stop cancels it", async () => {
    vi.useFakeTimers();
    const canvas = createTurtleCanvas("t");
    const tick = proxy();
    canvas.after(100, tick);
    let idle = false;
    void canvas.__whenIdle().then(() => {
      idle = true;
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(idle).toBe(false);
    await vi.advanceTimersByTimeAsync(60);
    expect(tick).toHaveBeenCalledTimes(1);
    expect(tick.destroy).toHaveBeenCalled();
    expect(idle).toBe(true);

    const never = proxy();
    canvas.after(100, never);
    canvas.__stop();
    await vi.advanceTimersByTimeAsync(200);
    expect(never).not.toHaveBeenCalled();
    expect(never.destroy).toHaveBeenCalled();
  });
});

describe("turtle completions", () => {
  const read = (name: string) =>
    readFileSync(
      new URL(`../assets/directive-pyide/src/${name}`, import.meta.url),
      "utf8",
    );

  it("only offer names the turtle module exports", () => {
    const module = read("turtle.py");
    const lists = module.slice(
      module.indexOf("_tg_classes = "),
      module.indexOf("_alias_list = "),
    );
    const exported = new Set(
      [...lists.matchAll(/'(\w+)'/g)].map((match) => match[1]),
    );
    // Entries are written as ["name", "signature", "description"].
    const offered = [
      ...read("turtle-completions.js").matchAll(/^\s*\[\s*"(\w+)",/gm),
    ].map((match) => match[1]);
    expect(offered.length).toBeGreaterThan(100);
    expect(offered.filter((name) => !exported.has(name))).toEqual([]);
  });
});
