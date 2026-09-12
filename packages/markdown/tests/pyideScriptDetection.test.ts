import { describe, expect, it } from "vitest";

/**
 * Mirrors assets/directive-pyide/src/constants.js exactly. The two checks
 * decide whether a script gets the turtle canvas binding or the pygame
 * `set_mode` canvas resize. If one of them drifts from the client, pygame
 * frames get clipped to the HTML default of 300x150 again — silently, since
 * `screen.get_size()` still reports the size the script asked for.
 */
const scriptLooksLikeTurtle = (script?: string) =>
  /\bfrom\s+turtle\s+import\b|\bimport\s+turtle\b/.test(String(script || ""));

const scriptLooksLikePygame = (script?: string) =>
  /\bfrom\s+pygame\b|\bimport\s+pygame\b/.test(String(script || ""));

describe("pyide script detection", () => {
  describe("scriptLooksLikePygame", () => {
    it("detects a plain import", () => {
      expect(scriptLooksLikePygame("import pygame\npygame.init()")).toBe(true);
    });

    it("detects a from-import", () => {
      expect(scriptLooksLikePygame("from pygame import Rect")).toBe(true);
    });

    it("detects a submodule import", () => {
      expect(scriptLooksLikePygame("from pygame.locals import *")).toBe(true);
    });

    it("ignores scripts without pygame", () => {
      expect(scriptLooksLikePygame("import random\nprint(1)")).toBe(false);
    });

    it("does not fire on a name that merely contains pygame", () => {
      expect(scriptLooksLikePygame("import mypygamehelper")).toBe(false);
    });

    it("tolerates empty input", () => {
      expect(scriptLooksLikePygame("")).toBe(false);
      expect(scriptLooksLikePygame(undefined)).toBe(false);
    });
  });

  describe("the two checks stay independent", () => {
    it("a turtle script is not treated as pygame", () => {
      expect(scriptLooksLikeTurtle("from turtle import *")).toBe(true);
      expect(scriptLooksLikePygame("from turtle import *")).toBe(false);
    });

    it("a pygame script is not treated as turtle", () => {
      expect(scriptLooksLikePygame("import pygame")).toBe(true);
      expect(scriptLooksLikeTurtle("import pygame")).toBe(false);
    });
  });
});
