import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const script = readFileSync(
  new URL("../assets/cdn-workers.js", import.meta.url),
  "utf8",
);

function browser() {
  const blobs: Blob[] = [];
  class NativeWorker {
    listeners = new Map<string, () => void>();
    terminated = false;
    constructor(
      public script: string | URL,
      public options: unknown,
    ) {}
    addEventListener(event: string, callback: () => void) {
      this.listeners.set(event, callback);
    }
    terminate() {
      this.terminated = true;
    }
  }
  class BrowserURL extends URL {
    static createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return "blob:https://book.example/worker";
    });
    static revokeObjectURL = vi.fn();
  }
  const window = {
    Worker: NativeWorker,
    location: { origin: "https://book.example" },
  };
  runInNewContext(script, {
    window,
    Blob,
    URL: BrowserURL,
    document: { baseURI: "https://book.example/course/" },
  });
  return { window, blobs, BrowserURL };
}

it("passes same-origin and Blob workers through with their original options", () => {
  const { window, blobs } = browser();
  const options = { type: "module", name: "editor" };
  for (const script of [
    "worker.js",
    "https://book.example/worker.js",
    "blob:https://book.example/123",
  ]) {
    const worker = new window.Worker(script, options);
    expect(worker.script).toBe(script);
    expect(worker.options).toBe(options);
  }
  expect(blobs).toHaveLength(0);
});

it("keeps cross-origin workers' relative WASM URLs on their CDN", async () => {
  const { window, blobs } = browser();
  const remote = "https://cdn.example/assets/worker.js";
  const worker = new window.Worker(remote, {});
  expect(worker.script).toBe("blob:https://book.example/worker");
  const imported: string[] = [];
  const self = { location: { href: String(worker.script) } };
  runInNewContext(await blobs[0].text(), {
    self,
    URL,
    importScripts(url: string) {
      imported.push(url);
      expect(new URL("sqlite.wasm", self.location.href).href).toBe(
        "https://cdn.example/assets/sqlite.wasm",
      );
    },
  });
  expect(imported).toEqual([remote]);
});

it.each(["message", "error", "terminate"])(
  "releases the bootstrap URL on %s",
  (event: string) => {
    const { window, BrowserURL } = browser();
    const worker = new window.Worker("https://cdn.example/worker.js", {
      type: "module",
    });
    if (event === "terminate") worker.terminate();
    else worker.listeners.get(event)!();
    worker.terminate();
    expect(worker.terminated).toBe(true);
    expect(BrowserURL.revokeObjectURL).toHaveBeenCalledOnce();
    expect(BrowserURL.revokeObjectURL).toHaveBeenCalledWith(
      "blob:https://book.example/worker",
    );
  },
);
