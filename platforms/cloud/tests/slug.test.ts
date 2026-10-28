import { describe, expect, it } from "vitest";
import { checkSlug, labelFromHost } from "../src/server/domain/slug";

describe("checkSlug", () => {
  it.each(["physics", "physics-7a", "a", "x".repeat(63)])("accepts %s", (slug) => {
    expect(checkSlug(slug)).toBeNull();
  });

  it.each(["", "-a", "a-", "Physics", "a_b", "a.b", "x".repeat(64)])(
    "rejects the format of %j",
    (slug) => {
      expect(checkSlug(slug)).toBe("format");
    },
  );

  it("keeps double hyphens free for derived hosts", () => {
    expect(checkSlug("physics--preview")).toBe("double-hyphen");
  });

  it("rejects reserved names", () => {
    expect(checkSlug("www")).toBe("reserved");
    expect(checkSlug("api")).toBe("reserved");
  });
});

describe("labelFromHost", () => {
  it("returns the label directly below the books domain", () => {
    expect(labelFromHost("physics.example.page", "example.page")).toBe("physics");
    expect(labelFromHost("Physics.Example.Page", "example.page")).toBe("physics");
    expect(labelFromHost("physics--preview.example.page", "example.page")).toBe(
      "physics--preview",
    );
    expect(labelFromHost("a.books.localhost:3001", "books.localhost:3001")).toBe("a");
  });

  it("ignores other hosts", () => {
    expect(labelFromHost(undefined, "example.page")).toBeNull();
    expect(labelFromHost("example.page", "example.page")).toBeNull();
    expect(labelFromHost("a.b.example.page", "example.page")).toBeNull();
    expect(labelFromHost("physicsexample.page", "example.page")).toBeNull();
    expect(labelFromHost("physics.example.page.evil.org", "example.page")).toBeNull();
  });
});
