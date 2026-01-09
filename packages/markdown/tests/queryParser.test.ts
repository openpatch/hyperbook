import { describe, expect, it } from "vitest";
import { HyperbookPage } from "@hyperbook/types";
import {
  tokenize,
  parseQuery,
  evaluateQuery,
  evaluateCondition,
  compareValues,
  createPageSorter,
  QueryNode,
} from "../src/queryParser";

describe("queryParser", () => {
  describe("tokenize", () => {
    it("should tokenize simple condition", () => {
      expect(tokenize("href(/elements/.*)")).toEqual(["href(/elements/.*)"]);
    });

    it("should tokenize AND expression", () => {
      expect(tokenize("href(/a) AND name(test)")).toEqual([
        "href(/a)",
        "AND",
        "name(test)",
      ]);
    });

    it("should tokenize OR expression", () => {
      expect(tokenize("href(/a) OR name(test)")).toEqual([
        "href(/a)",
        "OR",
        "name(test)",
      ]);
    });

    it("should tokenize NOT expression", () => {
      expect(tokenize("NOT href(/a)")).toEqual(["NOT", "href(/a)"]);
    });

    it("should tokenize parentheses", () => {
      expect(tokenize("(href(/a) OR name(b)) AND keyword(c)")).toEqual([
        "(",
        "href(/a)",
        "OR",
        "name(b)",
        ")",
        "AND",
        "keyword(c)",
      ]);
    });

    it("should handle case-insensitive operators", () => {
      expect(tokenize("href(/a) and name(b) or keyword(c)")).toEqual([
        "href(/a)",
        "AND",
        "name(b)",
        "OR",
        "keyword(c)",
      ]);
    });

    it("should tokenize custom field names", () => {
      expect(tokenize("difficulty(beginner) AND tags(media)")).toEqual([
        "difficulty(beginner)",
        "AND",
        "tags(media)",
      ]);
    });
  });

  describe("parseQuery", () => {
    it("should parse simple condition", () => {
      const result = parseQuery("href(/elements/.*)");
      expect(result).toEqual({
        type: "condition",
        field: "href",
        regex: "/elements/.*",
      });
    });

    it("should parse AND expression", () => {
      const result = parseQuery("href(/a) AND name(test)");
      expect(result).toEqual({
        type: "AND",
        left: { type: "condition", field: "href", regex: "/a" },
        right: { type: "condition", field: "name", regex: "test" },
      });
    });

    it("should parse OR expression", () => {
      const result = parseQuery("href(/a) OR name(test)");
      expect(result).toEqual({
        type: "OR",
        left: { type: "condition", field: "href", regex: "/a" },
        right: { type: "condition", field: "name", regex: "test" },
      });
    });

    it("should parse NOT expression", () => {
      const result = parseQuery("NOT href(/a)");
      expect(result).toEqual({
        type: "NOT",
        operand: { type: "condition", field: "href", regex: "/a" },
      });
    });

    it("should respect operator precedence (NOT > AND > OR)", () => {
      const result = parseQuery("a(1) OR b(2) AND NOT c(3)");
      expect(result).toEqual({
        type: "OR",
        left: { type: "condition", field: "a", regex: "1" },
        right: {
          type: "AND",
          left: { type: "condition", field: "b", regex: "2" },
          right: {
            type: "NOT",
            operand: { type: "condition", field: "c", regex: "3" },
          },
        },
      });
    });

    it("should parse parentheses for grouping", () => {
      const result = parseQuery("(a(1) OR b(2)) AND c(3)");
      expect(result).toEqual({
        type: "AND",
        left: {
          type: "OR",
          left: { type: "condition", field: "a", regex: "1" },
          right: { type: "condition", field: "b", regex: "2" },
        },
        right: { type: "condition", field: "c", regex: "3" },
      });
    });

    it("should parse nested parentheses", () => {
      const result = parseQuery("((a(1) OR b(2)) AND c(3)) OR d(4)");
      expect(result).toEqual({
        type: "OR",
        left: {
          type: "AND",
          left: {
            type: "OR",
            left: { type: "condition", field: "a", regex: "1" },
            right: { type: "condition", field: "b", regex: "2" },
          },
          right: { type: "condition", field: "c", regex: "3" },
        },
        right: { type: "condition", field: "d", regex: "4" },
      });
    });

    it("should return null for empty query", () => {
      expect(parseQuery("")).toBeNull();
    });

    it("should parse multiple chained OR", () => {
      const result = parseQuery("a(1) OR b(2) OR c(3)");
      expect(result).toEqual({
        type: "OR",
        left: {
          type: "OR",
          left: { type: "condition", field: "a", regex: "1" },
          right: { type: "condition", field: "b", regex: "2" },
        },
        right: { type: "condition", field: "c", regex: "3" },
      });
    });

    it("should parse multiple chained AND", () => {
      const result = parseQuery("a(1) AND b(2) AND c(3)");
      expect(result).toEqual({
        type: "AND",
        left: {
          type: "AND",
          left: { type: "condition", field: "a", regex: "1" },
          right: { type: "condition", field: "b", regex: "2" },
        },
        right: { type: "condition", field: "c", regex: "3" },
      });
    });
  });

  describe("evaluateCondition", () => {
    const basePage: HyperbookPage & Record<string, unknown> = {
      name: "Test Page",
      href: "/elements/video",
      description: "A test description",
      keywords: ["test", "video"],
    };

    it("should match href", () => {
      expect(evaluateCondition("href", "/elements/.*", basePage)).toBe(true);
      expect(evaluateCondition("href", "/other/.*", basePage)).toBe(false);
    });

    it("should match name", () => {
      expect(evaluateCondition("name", "Test.*", basePage)).toBe(true);
      expect(evaluateCondition("name", "Other.*", basePage)).toBe(false);
    });

    it("should match keyword", () => {
      expect(evaluateCondition("keyword", "test", basePage)).toBe(true);
      expect(evaluateCondition("keyword", "video", basePage)).toBe(true);
      expect(evaluateCondition("keyword", "other", basePage)).toBe(false);
    });

    it("should match description", () => {
      expect(evaluateCondition("description", "test.*", basePage)).toBe(true);
      expect(evaluateCondition("description", "other.*", basePage)).toBe(false);
    });

    it("should match custom string field", () => {
      const page = { ...basePage, difficulty: "beginner" };
      expect(evaluateCondition("difficulty", "beginner", page)).toBe(true);
      expect(evaluateCondition("difficulty", "advanced", page)).toBe(false);
    });

    it("should match custom array field", () => {
      const page = { ...basePage, tags: ["media", "embed"] };
      expect(evaluateCondition("tags", "media", page)).toBe(true);
      expect(evaluateCondition("tags", "embed", page)).toBe(true);
      expect(evaluateCondition("tags", "other", page)).toBe(false);
    });

    it("should match custom number field", () => {
      const page = { ...basePage, priority: 5 };
      expect(evaluateCondition("priority", "5", page)).toBe(true);
      expect(evaluateCondition("priority", "3", page)).toBe(false);
    });

    it("should match custom boolean field", () => {
      const page = { ...basePage, featured: true };
      expect(evaluateCondition("featured", "true", page)).toBe(true);
      expect(evaluateCondition("featured", "false", page)).toBe(false);
    });

    it("should return false for missing field", () => {
      expect(evaluateCondition("nonexistent", ".*", basePage)).toBe(false);
    });

    it("should return false for null/undefined field", () => {
      const page = { ...basePage, nullField: null, undefinedField: undefined };
      expect(evaluateCondition("nullField", ".*", page)).toBe(false);
      expect(evaluateCondition("undefinedField", ".*", page)).toBe(false);
    });
  });

  describe("evaluateQuery", () => {
    const page: HyperbookPage & Record<string, unknown> = {
      name: "Video",
      href: "/elements/video",
      keywords: ["test", "media"],
      difficulty: "beginner",
      tags: ["media", "embed"],
    };

    it("should return true for null query", () => {
      expect(evaluateQuery(null, page)).toBe(true);
    });

    it("should evaluate simple condition", () => {
      expect(evaluateQuery(parseQuery("name(Video)"), page)).toBe(true);
      expect(evaluateQuery(parseQuery("name(Audio)"), page)).toBe(false);
    });

    it("should evaluate AND", () => {
      expect(evaluateQuery(parseQuery("name(Video) AND keyword(test)"), page)).toBe(true);
      expect(evaluateQuery(parseQuery("name(Video) AND keyword(other)"), page)).toBe(false);
    });

    it("should evaluate OR", () => {
      expect(evaluateQuery(parseQuery("name(Video) OR name(Audio)"), page)).toBe(true);
      expect(evaluateQuery(parseQuery("name(Other) OR name(Audio)"), page)).toBe(false);
    });

    it("should evaluate NOT", () => {
      expect(evaluateQuery(parseQuery("NOT name(Audio)"), page)).toBe(true);
      expect(evaluateQuery(parseQuery("NOT name(Video)"), page)).toBe(false);
    });

    it("should evaluate complex expression", () => {
      expect(
        evaluateQuery(
          parseQuery("(name(Video) OR name(Audio)) AND keyword(test)"),
          page
        )
      ).toBe(true);
      expect(
        evaluateQuery(
          parseQuery("(name(Other) OR name(Audio)) AND keyword(test)"),
          page
        )
      ).toBe(false);
    });

    it("should evaluate custom frontmatter", () => {
      expect(evaluateQuery(parseQuery("difficulty(beginner)"), page)).toBe(true);
      expect(evaluateQuery(parseQuery("tags(media)"), page)).toBe(true);
      expect(
        evaluateQuery(parseQuery("difficulty(beginner) AND tags(embed)"), page)
      ).toBe(true);
    });

    it("should evaluate NOT with custom frontmatter", () => {
      expect(
        evaluateQuery(parseQuery("tags(media) AND NOT difficulty(advanced)"), page)
      ).toBe(true);
      expect(
        evaluateQuery(parseQuery("tags(media) AND NOT difficulty(beginner)"), page)
      ).toBe(false);
    });
  });

  describe("compareValues", () => {
    it("should compare strings", () => {
      expect(compareValues("apple", "banana")).toBeLessThan(0);
      expect(compareValues("banana", "apple")).toBeGreaterThan(0);
      expect(compareValues("apple", "apple")).toBe(0);
    });

    it("should compare numbers", () => {
      expect(compareValues(1, 2)).toBeLessThan(0);
      expect(compareValues(2, 1)).toBeGreaterThan(0);
      expect(compareValues(5, 5)).toBe(0);
    });

    it("should compare booleans", () => {
      expect(compareValues(false, true)).toBeLessThan(0);
      expect(compareValues(true, false)).toBeGreaterThan(0);
      expect(compareValues(true, true)).toBe(0);
      expect(compareValues(false, false)).toBe(0);
    });

    it("should sort null/undefined to end", () => {
      expect(compareValues(null, "value")).toBeGreaterThan(0);
      expect(compareValues(undefined, "value")).toBeGreaterThan(0);
      expect(compareValues("value", null)).toBeLessThan(0);
      expect(compareValues("value", undefined)).toBeLessThan(0);
      expect(compareValues(null, null)).toBe(0);
      expect(compareValues(undefined, undefined)).toBe(0);
      expect(compareValues(null, undefined)).toBe(0);
    });

    it("should fallback to string comparison for mixed types", () => {
      expect(compareValues("5", 10)).toBeDefined();
      expect(compareValues({ a: 1 }, { b: 2 })).toBeDefined();
    });
  });

  describe("createPageSorter", () => {
    const pages = [
      { name: "Charlie", index: 3, priority: 10, active: true },
      { name: "Alice", index: 1, priority: 30, active: false },
      { name: "Bob", index: 2, priority: 20, active: true },
    ];

    it("should sort by string field ascending", () => {
      const sorter = createPageSorter("name:asc");
      const sorted = [...pages].sort(sorter);
      expect(sorted.map((p) => p.name)).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("should sort by string field descending", () => {
      const sorter = createPageSorter("name:desc");
      const sorted = [...pages].sort(sorter);
      expect(sorted.map((p) => p.name)).toEqual(["Charlie", "Bob", "Alice"]);
    });

    it("should sort by number field ascending", () => {
      const sorter = createPageSorter("index:asc");
      const sorted = [...pages].sort(sorter);
      expect(sorted.map((p) => p.index)).toEqual([1, 2, 3]);
    });

    it("should sort by number field descending", () => {
      const sorter = createPageSorter("index:desc");
      const sorted = [...pages].sort(sorter);
      expect(sorted.map((p) => p.index)).toEqual([3, 2, 1]);
    });

    it("should sort by custom number field", () => {
      const sorter = createPageSorter("priority:asc");
      const sorted = [...pages].sort(sorter);
      expect(sorted.map((p) => p.priority)).toEqual([10, 20, 30]);
    });

    it("should sort by boolean field", () => {
      const sorter = createPageSorter("active:asc");
      const sorted = [...pages].sort(sorter);
      expect(sorted.map((p) => p.active)).toEqual([false, true, true]);
    });

    it("should sort by boolean field descending", () => {
      const sorter = createPageSorter("active:desc");
      const sorted = [...pages].sort(sorter);
      expect(sorted.map((p) => p.active)).toEqual([true, true, false]);
    });

    it("should handle missing fields by sorting to end", () => {
      const pagesWithMissing = [
        { name: "Bob", difficulty: "intermediate" },
        { name: "Alice" },
        { name: "Charlie", difficulty: "beginner" },
      ];
      const sorter = createPageSorter("difficulty:asc");
      const sorted = [...pagesWithMissing].sort(sorter);
      expect(sorted.map((p) => p.name)).toEqual(["Charlie", "Bob", "Alice"]);
    });

    it("should handle null values by sorting to end", () => {
      const pagesWithNull = [
        { name: "Bob", level: null },
        { name: "Alice", level: "high" },
        { name: "Charlie", level: "low" },
      ];
      const sorter = createPageSorter("level:asc");
      const sorted = [...pagesWithNull].sort(sorter);
      expect(sorted.map((p) => p.name)).toEqual(["Alice", "Charlie", "Bob"]);
    });

    it("should default to desc when mode not specified", () => {
      const sorter = createPageSorter("name");
      const sorted = [...pages].sort(sorter);
      expect(sorted.map((p) => p.name)).toEqual(["Charlie", "Bob", "Alice"]);
    });

    it("should default to name field when not specified", () => {
      const sorter = createPageSorter("");
      const sorted = [...pages].sort(sorter);
      expect(sorted.map((p) => p.name)).toEqual(["Charlie", "Bob", "Alice"]);
    });
  });
});
