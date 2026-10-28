import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server/app";
import { setup } from "./helpers";

const { deps } = setup();

function request(app: ReturnType<typeof createApp>, host: string, pathname: string) {
  return app.request(pathname, { headers: { host } });
}

describe("host dispatch", () => {
  const app = createApp(deps);

  it("answers the health check on any host", async () => {
    const res = await request(app, "10.0.0.5:3001", "/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("sends book hosts to the books app", async () => {
    const res = await request(app, "physics.books.test", "/");
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("There is no book at this address.");
  });

  it("does not serve the admin API on book hosts", async () => {
    const res = await request(app, "physics.books.test", "/api/anything");
    expect(await res.text()).toContain("There is no book at this address.");
  });

  it("answers unknown API paths on the admin host with JSON", async () => {
    const res = await request(app, "admin.test", "/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("rejects unknown hosts", async () => {
    for (const host of ["evil.example", "books.test", "a.b.books.test"]) {
      const res = await request(app, host, "/");
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Unknown host.");
    }
  });
});

describe("app shell", () => {
  const webRoot = mkdtempSync(path.join(tmpdir(), "hyperbook-cloud-web-"));
  writeFileSync(path.join(webRoot, "index.html"), "<!doctype html><title>shell</title>");
  writeFileSync(path.join(webRoot, "app.js"), "console.log(1)");
  const app = createApp(deps, { webRoot });

  it("serves built files", async () => {
    const res = await request(app, "admin.test", "/app.js");
    expect(await res.text()).toBe("console.log(1)");
  });

  it("serves the shell for client-side routes", async () => {
    const res = await request(app, "admin.test", "/books/42");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<title>shell</title>");
  });

  it("does not answer unknown API paths with the shell", async () => {
    const res = await request(app, "admin.test", "/api/nope");
    expect(res.status).toBe(404);
  });
});
