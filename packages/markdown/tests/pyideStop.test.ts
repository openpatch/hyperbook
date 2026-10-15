import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

/** A pyide element with the input form stdin.js looks for. */
const stubStdinDom = () => {
  const form = {
    classList: { add: vi.fn(), remove: vi.fn() },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    scrollIntoView: vi.fn(),
  };
  const field = { value: "", focus: vi.fn() };
  const label = { textContent: "" };
  const byClass: Record<string, unknown> = {
    stdin: form,
    "stdin-field": field,
    "stdin-prompt": label,
  };
  vi.stubGlobal("document", {
    getElementById: () => ({
      getElementsByClassName: (name: string) => [byClass[name]],
    }),
  });
};

describe("stdin", () => {
  it("ends a waiting read with an error when the program is stopped", async () => {
    stubStdinDom();
    const { askStdinAsync, abortStdin } =
      // @ts-expect-error The browser client is JavaScript.
      await import("../assets/directive-pyide/src/stdin.js");
    const answer = askStdinAsync("ide", "Name?");
    abortStdin("ide");
    await expect(answer).rejects.toThrow("stopped");
  });

  it("hands an empty answer to a read that a new question replaces", async () => {
    stubStdinDom();
    const { askStdinAsync } =
      // @ts-expect-error The browser client is JavaScript.
      await import("../assets/directive-pyide/src/stdin.js");
    const first = askStdinAsync("ide", "First?");
    void askStdinAsync("ide", "Second?");
    await expect(first).resolves.toBe("");
  });
});

describe("returnAfterReload", () => {
  const load = async (saved: unknown) => {
    const storage = new Map<string, string>();
    if (saved) storage.set("hyperbook-pyide-return", JSON.stringify(saved));
    const scroller = { scrollTop: 1000 };
    vi.stubGlobal("window", {
      location: { pathname: "/lesson", search: "" },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
      addEventListener: vi.fn(),
      // Importing ui.js also imports pyodide.js, which starts loading Pyodide.
      loadPyodide: vi.fn(),
    });
    vi.stubGlobal("document", {
      baseURI: "https://example.com/lesson",
      querySelector: () => null,
      readyState: "complete",
      scrollingElement: scroller,
    });
    vi.stubGlobal("HYPERBOOK_ASSETS", "/assets/");
    vi.stubGlobal("getComputedStyle", () => ({ overflowY: "visible" }));
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) =>
      callback(),
    );
    const { returnAfterReload } =
      // @ts-expect-error The browser client is JavaScript.
      await import("../assets/directive-pyide/src/ui.js");
    const elem = {
      id: "ide",
      parentElement: null,
      getBoundingClientRect: () => ({ top: 500 }),
    };
    return { returnAfterReload, elem, scroller, storage };
  };

  it("scrolls the IDE back to where it was before the reload", async () => {
    const { returnAfterReload, elem, scroller, storage } = await load({
      page: "/lesson",
      id: "ide",
      top: 220,
    });
    expect(returnAfterReload(elem)).toBe(true);
    expect(scroller.scrollTop).toBe(1280);
    expect(storage.size).toBe(0);
  });

  it("leaves other IDEs and pages alone", async () => {
    const other = await load({ page: "/lesson", id: "another", top: 220 });
    expect(other.returnAfterReload(other.elem)).toBe(false);
    expect(other.scroller.scrollTop).toBe(1000);

    const elsewhere = await load({ page: "/other", id: "ide", top: 220 });
    expect(elsewhere.returnAfterReload(elsewhere.elem)).toBe(false);
  });
});
