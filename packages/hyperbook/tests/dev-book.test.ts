import { afterAll, beforeAll, expect, test } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import net from "net";
import { WebSocket } from "ws";
import { runDev } from "../dev";

let root: string;
let cwd: string;
let port: number;

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address() as net.AddressInfo;
      s.close(() => resolve(port));
    });
  });

const write = async (file: string, text: string) => {
  await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await fs.writeFile(path.join(root, file), text);
};

const get = (pathname: string) => fetch(`http://localhost:${port}${pathname}`);

/** Resolves with the next reload the server broadcasts. */
const nextReload = async () => {
  const ws = new WebSocket(`ws://localhost:${port}`);
  await new Promise((resolve) => ws.once("open", resolve));
  return {
    reload: new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no reload within 20s")), 20_000);
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "reload") {
          clearTimeout(timer);
          ws.close();
          resolve(msg);
        }
      });
    }),
  };
};

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "hyperbook-dev-book-"));
  await write(
    "hyperbook.json",
    JSON.stringify({
      name: "Book",
      search: true,
      llms: true,
      exclude: ["intern/**"],
    }),
  );
  await write("book/index.md", "---\nname: Start\n---\n\n# Welcome\n");
  await write("book/loops.md", "---\nname: Loops\n---\n\nAbout loops.\n");
  await write("book/picture.svg", "<svg xmlns='http://www.w3.org/2000/svg'/>");
  await write("public/data.txt", "from public");
  // Matched by `exclude`: a build would not copy these.
  await write("public/intern/key.txt", "secret");
  await write("book/intern/exam.txt", "secret");
  await write("glossary/oop.md", "---\nname: OOP\n---\n\n# Objects\n\nAbout objects.\n");
  // Left over from an earlier build: must not be served.
  await write(".hyperbook/out/gone.html", "<html><body>stale</body></html>");
  await write(".hyperbook/out/stale.txt", "stale");

  cwd = process.cwd();
  process.chdir(root);
  port = await freePort();
  await runDev({ port });
}, 120_000);

afterAll(async () => {
  process.chdir(cwd);
  await fs.rm(root, { recursive: true, force: true });
});

test("renders a page when it is asked for, with the dev client", async () => {
  const res = await get("/loops");
  expect(res.status).toBe(200);
  const body = await res.text();
  expect(body).toContain("About loops.");
  expect(body).toContain("/__hyperbook_dev.js");
  expect((await get("/glossary/oop")).status).toBe(200);
});

test("serves the book's files from where they are, but not its pages' text", async () => {
  expect(await (await get("/data.txt")).text()).toBe("from public");
  const svg = await get("/picture.svg");
  expect(svg.status).toBe(200);
  expect(svg.headers.get("content-type")).toContain("svg");
  expect((await get("/loops.md")).status).toBe(404);
});

test("does not serve files matched by exclude", async () => {
  expect((await get("/intern/key.txt")).status).toBe(404);
  expect((await get("/intern/exam.txt")).status).toBe(404);
});

test("does not serve what an earlier build left behind", async () => {
  expect((await get("/gone")).status).toBe(404);
  expect((await get("/stale.txt")).status).toBe(404);
});

test("shows a change on the next visit", async () => {
  const { reload } = await nextReload();
  await write("book/loops.md", "---\nname: Loops\n---\n\nAbout while loops.\n");
  expect((await reload).changedPages).toBe("*");
  expect(await (await get("/loops")).text()).toContain("About while loops.");
}, 30_000);

test("shows a page added meanwhile, in the navigation of the others too", async () => {
  const { reload } = await nextReload();
  await write("book/arrays.md", "---\nname: Arrays\n---\n\nAbout arrays.\n");
  await reload;
  expect(await (await get("/arrays")).text()).toContain("About arrays.");
  expect(await (await get("/")).text()).toContain("Arrays");
}, 30_000);

test("a deleted page is gone, though its output is still there", async () => {
  const { reload } = await nextReload();
  await fs.rm(path.join(root, "book", "arrays.md"));
  await reload;
  expect((await get("/arrays")).status).toBe(404);
  expect(await (await get("/")).text()).not.toContain("Arrays");
}, 30_000);

test("indexes every page for search, visited or not", async () => {
  // The index fills in the background.
  let search = "";
  for (let i = 0; i < 50; i++) {
    search = await (await get("/__hyperbook_assets/search.js")).text();
    if (search.includes("About objects.") && search.includes("Welcome")) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  expect(search).toContain("LUNR_INDEX");
  expect(search).toContain("About objects.");
  expect(search).toContain("Welcome");
}, 30_000);

test("makes llms.txt when it is asked for", async () => {
  const res = await get("/llms.txt");
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("About");
});
