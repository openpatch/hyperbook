import type { Browser, Page } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logIn } from "./login";
import { ADMIN, launchBrowser, startServer } from "./server";

let server: Awaited<ReturnType<typeof startServer>>;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  server = await startServer();
  browser = await launchBrowser();
  page = await browser.newPage({ locale: "en-US" });
  await logIn(page, server.origin, ADMIN.email, ADMIN.password);
});

afterAll(async () => {
  await browser?.close();
  await server?.stop();
});

describe("editor", () => {
  it("starts a book from a template, previews a save and publishes it", async () => {
    await page.getByRole("button", { name: "New book" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill("Waves");
    await dialog.getByRole("button", { name: "Create book" }).click();
    await page.getByRole("link", { name: "Edit book" }).click();
    await page.getByRole("button", { name: "Example pages" }).click();

    // The start page opens; the preview shows it once the first build is done.
    const editor = page.locator(".cm-content");
    await editor.getByText("# Waves").waitFor();
    const preview = page.frameLocator('iframe[title="Preview"]');
    await preview.getByRole("heading", { name: "Waves" }).waitFor({ timeout: 60_000 });

    // Edit the heading and save with the keyboard.
    await editor.getByText("# Waves").click();
    await page.keyboard.press("End");
    await page.keyboard.type(" and sound");
    await page.getByTitle("Not saved").first().waitFor();
    await page.keyboard.press("Control+s");
    await page.getByTitle("Not saved").first().waitFor({ state: "detached" });
    await preview.getByRole("heading", { name: "Waves and sound" }).waitFor({ timeout: 60_000 });

    // Nothing is live until it is published.
    const live = await browser.newPage({ locale: "en-US" });
    await live.goto(`http://waves.books.localhost:${server.port}/`);
    await live.getByText("This book is not published yet.").waitFor();

    await page.getByRole("button", { name: "Publish" }).click();
    await page.getByText("Published.").waitFor();
    await live.reload();
    await live.getByRole("heading", { name: "Waves and sound" }).waitFor();
    await live.close();
  }, 120_000);

  it("adds a page that the preview follows", async () => {
    await page.getByRole("button", { name: "New file" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Path").fill("book/echo.md");
    await dialog.getByRole("button", { name: "Create" }).click();
    await page.getByRole("tab", { name: "echo.md" }).waitFor();
    const preview = page.frameLocator('iframe[title="Preview"]');
    await preview.getByRole("heading", { name: "Echo" }).waitFor({ timeout: 60_000 });
  }, 90_000);

  it("edits a learning map in its own editor and saves it as a file", async () => {
    await page.getByRole("button", { name: "New file" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Path").fill("book/map.learningmap");
    await dialog.getByRole("button", { name: "Create" }).click();
    await page.getByRole("tab", { name: "map.learningmap" }).waitFor();

    const map = page.frameLocator('iframe[title="learningmap editor"]');
    // The platform keeps the file: nothing to open, nothing kept in the browser.
    await map.getByRole("button", { name: /add topic/i }).waitFor();
    expect(await map.getByRole("button", { name: /open file/i }).count()).toBe(0);
    expect(await map.getByText(/stored locally/i).count()).toBe(0);
    await map.getByRole("button", { name: /add topic/i }).click();
    await page.getByTitle("Not saved").first().waitFor();
    // Saving works from inside the frame, too, without the element
    // downloading a copy of its own.
    const downloads: string[] = [];
    page.on("download", (d) => downloads.push(d.suggestedFilename()));
    await map.locator(".react-flow").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+s");
    await page.getByTitle("Not saved").first().waitFor({ state: "detached" });

    const saved = await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      const res = await fetch(`/api/books/${id}/files/raw?path=book/map.learningmap`);
      return JSON.parse(await res.text());
    });
    expect(saved.nodes).toHaveLength(1);
    expect(saved.nodes[0].type).toBe("topic");
    expect(downloads).toEqual([]);

    // The source view shows the same file.
    await page.getByRole("button", { name: "Source" }).click();
    await page.locator(".cm-content").getByText('"type": "topic"').waitFor();
  }, 60_000);

  it("draws in Excalidraw with fonts from the platform", async () => {
    // Excalidraw lists a CDN as fallback for every font; the CSP must keep
    // the browser from ever reaching it.
    const requests: string[] = [];
    page.on("requestfinished", (req) => requests.push(req.url()));
    await page.getByRole("button", { name: "New file" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Path").fill("book/sketch.excalidraw");
    await dialog.getByRole("button", { name: "Create" }).click();
    await page.getByRole("tab", { name: "sketch.excalidraw" }).waitFor();

    const frame = page.frameLocator('iframe[title="excalidraw editor"]');
    const canvas = frame.locator("canvas.interactive");
    await canvas.waitFor();
    // Text makes Excalidraw load its hand-drawn font.
    await canvas.dblclick({ position: { x: 200, y: 200 } });
    await page.keyboard.type("Hello");
    await page.keyboard.press("Escape");
    await page.getByTitle("Not saved").first().waitFor();
    await page.getByRole("button", { name: "Save all" }).click();
    await page.getByTitle("Not saved").first().waitFor({ state: "detached" });

    const saved = await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      return (await fetch(`/api/books/${id}/files/raw?path=book/sketch.excalidraw`)).json();
    });
    expect(saved.type).toBe("excalidraw");
    expect(saved.elements.map((e: { type: string }) => e.type)).toContain("text");
    expect(requests.some((url) => url.includes("/excalidraw-assets/fonts/"))).toBe(true);
    expect(requests.filter((url) => !url.startsWith(server.origin) && !url.includes(".books.localhost"))).toEqual([]);
  }, 60_000);

  it("saves a Java memory diagram with the playground's own save button", async () => {
    await page.getByRole("button", { name: "New file" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Path").fill("book/memory.jmp");
    await dialog.getByRole("button", { name: "Create" }).click();
    await page.getByRole("tab", { name: "memory.jmp" }).waitFor();

    // An empty file starts with the playground's example diagram, unsaved.
    await page.getByTitle("Not saved").first().waitFor();
    const frame = page.frameLocator('iframe[title="jmp editor"]');
    await frame.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByTitle("Not saved").first().waitFor({ state: "detached" });

    const saved = await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      return (await fetch(`/api/books/${id}/files/raw?path=book/memory.jmp`)).json();
    });
    expect(typeof saved).toBe("object");
    expect(Object.keys(saved).length).toBeGreaterThan(0);
    // None of the visual editors reported an error along the way.
    expect(await page.getByText("The editor reported a problem").count()).toBe(0);
  }, 60_000);

  it("edits a .bitflow file in bitflow's editor", async () => {
    // A page with the directive and an empty assessment, saved through the API.
    await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      await fetch(`/api/books/${id}/files/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          changes: [
            { op: "write", path: "book/quiz.md", content: '::bitflow{src="quiz.bitflow"}\n', baseOid: null },
            { op: "write", path: "book/quiz.bitflow", content: "", baseOid: null },
          ],
        }),
      });
    });
    await page.reload();
    await page.getByRole("list", { name: "Files" }).getByRole("button", { name: "quiz.bitflow", exact: true }).click();

    const frame = page.frameLocator('iframe[title="bitflow editor"]');
    await frame.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByTitle("Not saved").first().waitFor();
    await frame.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByTitle("Not saved").first().waitFor({ state: "detached" });

    const saved = await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      return (await fetch(`/api/books/${id}/files/raw?path=book/quiz.bitflow`)).json();
    });
    expect(saved.nodes).toHaveLength(1);
  }, 60_000);

  it("edits a .sb3 file in the blockflow editor", async () => {
    // A page with the directive and an empty Scratch project, saved through
    // the API (the .sb3 is binary, so base64).
    const { zipSync } = await import("fflate");
    const backdrop =
      '<svg version="1.1" width="480" height="360" viewBox="0 0 480 360" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M0 0h480v360H0z" fill="#ffffff" stroke="none"/></svg>';
    const project = {
      targets: [
        {
          isStage: true, name: "Stage", variables: {}, lists: {}, broadcasts: {}, blocks: {}, comments: {},
          currentCostume: 0,
          costumes: [{ assetId: "cd21514d0531fdffb22204e0ec5ed84a", name: "backdrop1", md5ext: "cd21514d0531fdffb22204e0ec5ed84a.svg", dataFormat: "svg", rotationCenterX: 240, rotationCenterY: 180 }],
          sounds: [], volume: 100, layerOrder: 0, tempo: 60, videoTransparency: 50, videoState: "on", textToSpeechLanguage: null,
        },
      ],
      monitors: [], extensions: [],
      meta: { semver: "3.0.0", vm: "0.2.0", agent: "e2e" },
    };
    const encode = (value: string) => new TextEncoder().encode(value);
    const sb3 = Buffer.from(
      zipSync({ "project.json": encode(JSON.stringify(project)), "cd21514d0531fdffb22204e0ec5ed84a.svg": encode(backdrop) }),
    ).toString("base64");
    await page.evaluate(async (sb3) => {
      const id = location.pathname.split("/")[2];
      await fetch(`/api/books/${id}/files/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          changes: [
            { op: "write", path: "book/game.md", content: '::blockflow-player{src="game.sb3"}\n', baseOid: null },
            { op: "write", path: "book/game.sb3", content: sb3, encoding: "base64", baseOid: null },
          ],
        }),
      });
    }, sb3);
    await page.reload();

    // "Edit visually" on the directive opens the .sb3 file's tab.
    await page.getByRole("list", { name: "Files" }).getByRole("button", { name: "game.md", exact: true }).click();
    await page.getByRole("button", { name: "Edit visually" }).click();
    await page.getByRole("tab", { name: "game.sb3", selected: true }).waitFor();

    // The visual frame speaks blockflow's embed protocol to the same-origin
    // embed-editor.html of the served runtime bundle. Wait for the frame to
    // actually navigate there (its initial about:blank has a body, too).
    let embedFrame: import("playwright-core").Frame | undefined;
    for (let i = 0; i < 120 && !embedFrame; i++) {
      embedFrame = page.frames().find((f) => f.url().includes("/blockflow/embed-editor.html"));
      if (!embedFrame) await page.waitForTimeout(500);
    }
    expect(embedFrame).toBeTruthy();
    // Wait until our project is in the VM (it has exactly one target, the
    // stage; the default project has two) — the embed attaches its change
    // listener right after the load, so only then do edits travel.
    for (let i = 0; i < 120; i++) {
      const loaded = await embedFrame!
        .evaluate(
          () =>
            !!(window as unknown as { vm?: { runtime?: { targets: unknown[] } } }).vm?.runtime &&
            (window as unknown as { vm: { runtime: { targets: unknown[] } } }).vm.runtime.targets.length === 1,
        )
        .catch(() => false);
      if (loaded) break;
      await page.waitForTimeout(500);
    }
    // An edit in the editor (here the VM's own change event) travels as a
    // "change" message and marks the file unsaved; saving writes a zip again.
    await embedFrame!.evaluate(() => (window as unknown as { vm: { emit: (e: string) => void } }).vm.emit("PROJECT_CHANGED"));
    await page.getByTitle("Not saved").first().waitFor({ timeout: 60_000 });
    await page.getByRole("button", { name: "Save all" }).click();
    await page.getByTitle("Not saved").first().waitFor({ state: "detached", timeout: 60_000 });

    const saved = await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      const bytes = new Uint8Array(await (await fetch(`/api/books/${id}/files/raw?path=book/game.sb3`)).arrayBuffer());
      return [bytes[0], bytes[1]];
    });
    expect(saved).toEqual([0x50, 0x4b]); // "PK": still a zip
    // None of the visual editors reported an error along the way.
    expect(await page.getByText("The editor reported a problem").count()).toBe(0);
  }, 90_000);

  it("edits a .blockflow project file in the blockflow generator", async () => {
    await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      await fetch(`/api/books/${id}/files/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          changes: [
            {
              op: "write",
              path: "book/tutorial.md",
              content: '::::blockflow-editor{project="tutorial.blockflow"}\n:::step{title="Welcome"}\nStart\n:::\n::::\n',
              baseOid: null,
            },
            {
              op: "write",
              path: "book/tutorial.blockflow",
              content: JSON.stringify({ title: "Tutorial", steps: [{ title: "Welcome", text: "Start" }] }, null, 2) + "\n",
              baseOid: null,
            },
          ],
        }),
      });
    });
    await page.reload();

    // "Edit visually" on the directive opens the project file's tab.
    await page.getByRole("list", { name: "Files" }).getByRole("button", { name: "tutorial.md", exact: true }).click();
    await page.getByRole("button", { name: "Edit visually" }).click();
    await page.getByRole("tab", { name: "tutorial.blockflow", selected: true }).waitFor();

    // The visual frame speaks the embed protocol to embed-generator.html.
    // The generator renders only after our "load", so wait for its first
    // text input (the project title; the generator's inputs carry no type
    // attribute and its label is not associated, so neither [type="text"]
    // nor getByLabel match).
    let title: import("playwright-core").Locator | undefined;
    for (let i = 0; i < 120 && !title; i++) {
      const genFrame = page.frames().find((f) => f.url().includes("/blockflow/embed-generator.html"));
      const candidate = genFrame?.locator('input:not([type])').first();
      if (candidate && (await candidate.count()) > 0 && (await candidate.isVisible().catch(() => false))) title = candidate;
      else await page.waitForTimeout(500);
    }
    expect(title).toBeTruthy();
    await title!.fill("My tutorial");
    await page.getByTitle("Not saved").first().waitFor({ timeout: 60_000 });
    await page.getByRole("button", { name: "Save all" }).click();
    await page.getByTitle("Not saved").first().waitFor({ state: "detached", timeout: 60_000 });

    const saved = await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      return (await fetch(`/api/books/${id}/files/raw?path=book/tutorial.blockflow`)).json();
    });
    expect(saved.title).toBe("My tutorial");
    expect(await page.getByText("The editor reported a problem").count()).toBe(0);
  }, 90_000);

  it("edits a structogram inside a page and writes it back", async () => {
    await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      await fetch(`/api/books/${id}/files/commit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          changes: [
            {
              op: "write",
              path: "book/loops.md",
              content: ':::struktolab{lang=en}\n```\noutput("a")\n```\n:::\n',
              baseOid: null,
            },
          ],
        }),
      });
    });
    await page.reload();
    await page.getByRole("list", { name: "Files" }).getByRole("button", { name: "loops.md", exact: true }).click();
    await page.getByRole("button", { name: "Edit visually" }).click();

    const dialog = page.getByRole("dialog");
    const frame = dialog.frameLocator('iframe[title="struktolab-pseudocode editor"]');
    const code = frame.locator("textarea");
    await code.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type('\noutput("b")');
    await dialog.getByRole("button", { name: "Apply" }).click();

    await page.locator(".cm-content").getByText('output("b")').waitFor();
    await page.getByTitle("Not saved").first().waitFor();
  }, 60_000);

  it("starts a missing learning map next to the page and opens it from there", async () => {
    await page.getByRole("tab", { name: "loops.md" }).click();
    const editor = page.locator(".cm-content:visible");
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type('\n::learningmap{src="path.learningmap" height="600px"}');

    // The directive names a file that is not in the book yet.
    await page.getByRole("button", { name: "Edit visually" }).last().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Create" }).click();

    // The starter file opens in its editor, next to the page.
    await page.getByRole("tab", { name: "path.learningmap" }).waitFor();
    await page.getByRole("list", { name: "Files" }).getByRole("button", { name: "path.learningmap", exact: true }).waitFor();

    await page.getByRole("tab", { name: "loops.md" }).click();
    await page.getByRole("button", { name: "Edit visually" }).last().click();
    await page.getByRole("tab", { name: "path.learningmap", selected: true }).waitFor();
  }, 60_000);

  it("uploads H5P content with the file tree and shows it in the page", async () => {
    await page.getByRole("tab", { name: "loops.md" }).click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Upload files" }).click();
    await (await chooser).setFiles({ name: "demo.h5p", mimeType: "application/zip", buffer: Buffer.from("PK") });
    await page.getByRole("list", { name: "Files" }).getByRole("button", { name: "demo.h5p", exact: true }).waitFor();

    const editor = page.locator(".cm-content:visible");
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type('\n::h5p{src="/demo.h5p"}');
    await editor.getByText('::h5p{src="/demo.h5p"}').waitFor();
  }, 60_000);

  it("starts a missing structogram as a .struktolab file next to the page and edits it", async () => {
    await page.getByRole("tab", { name: "loops.md" }).click();
    const editor = page.locator(".cm-content:visible");
    await editor.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type('\n::struktolab{src="countdown.struktolab"}');

    await page.getByRole("button", { name: "Edit visually" }).last().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Create" }).click();

    const tab = page.getByRole("tab", { name: "countdown.struktolab" });
    await tab.waitFor();
    const frame = page.frameLocator('iframe[title="struktolab editor"]');
    await frame.locator("textarea").click();
    // The platform keeps the file: no Save/Load of struktolab's own.
    expect(await frame.getByRole("button", { name: /save|load/i }).count()).toBe(0);
    await page.keyboard.type('output("Lift off")');
    await tab.getByTitle("Not saved").waitFor();
    await page.getByRole("button", { name: "Save all" }).click();
    await page.getByTitle("Not saved").first().waitFor({ state: "detached" });

    const saved = await page.evaluate(async () => {
      const id = location.pathname.split("/")[2];
      return (await fetch(`/api/books/${id}/files/raw?path=book/countdown.struktolab`)).text();
    });
    expect(saved).toContain("Lift off");
    expect(() => JSON.parse(saved)).not.toThrow();

    await page.getByRole("tab", { name: "loops.md" }).click();
    await editor.getByText('::struktolab{src="countdown.struktolab"}').waitFor();
  }, 60_000);
});

