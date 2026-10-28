import { describe, expect, it } from "vitest";
import { renderLegalMarkdown } from "../src/server/domain/legal";
import { bookClient } from "./book-client";
import { loggedIn, setup } from "./helpers";

describe("legal pages", () => {
  it("renders Markdown", () => {
    const html = renderLegalMarkdown("# Imprint\n\nOpenPatch, [mail](mailto:a@example.org) and [site](https://example.org).");
    expect(html).toContain("<h1>Imprint</h1>");
    expect(html).toContain('<a href="mailto:a@example.org">mail</a>');
    expect(html).toContain('<a href="https://example.org">site</a>');
  });

  it("keeps HTML and script links harmless", () => {
    const html = renderLegalMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1)) ![y](javascript:alert(1)) <b onclick="x">b</b>',
    );
    expect(html).not.toMatch(/<script|<img src=x|href="javascript|src="javascript|<b /);
    expect(html).toContain("&#60;script&#62;");
  });

  it("are linked from the students' login page on book hosts", async () => {
    const instance = setup();
    const admin = await loggedIn(instance, { email: "admin@example.org", role: "admin" });
    await admin.c.put("/api/instance", { imprintUrl: "https://example.org/imprint", privacyMarkdown: "# Privacy" });
    await admin.c.post("/api/books", { title: "Physics", slug: "physics" });
    const page = (await bookClient(instance, "physics.books.test").get("/_hyperbook/login")).body as string;
    expect(page).toContain('href="https://example.org/imprint"');
    expect(page).toContain('href="http://admin.test/privacy"');
  });
});
