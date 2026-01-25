import path from "path";
import { describe, it, expect } from "vitest";
import { hyperbook } from "../src";

describe("navigation bug test", () => {
  it("should correctly generate page list and sections with navigation property", async () => {
    const hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    
    // Get pages and sections
    const pagesAndSections = await hyperbook.getPagesAndSections(hyperbookPath);
    const pageList = hyperbook.getPageList(
      pagesAndSections.sections,
      pagesAndSections.pages,
    );
    
    // Verify page list is not empty
    expect(pageList).toBeDefined();
    expect(pageList.length).toBeGreaterThan(0);
    
    // Verify each page has expected properties
    pageList.forEach((page) => {
      expect(page).toHaveProperty("href");
      expect(page).toHaveProperty("name");
      // navigation property might be undefined (uses default) or explicitly set
      expect(page.navigation === undefined || typeof page.navigation === "string").toBe(true);
    });
    
    // Verify sections structure
    expect(pagesAndSections.sections).toBeDefined();
    expect(Array.isArray(pagesAndSections.sections)).toBe(true);
    
    pagesAndSections.sections.forEach((section) => {
      expect(section).toHaveProperty("name");
      expect(section).toHaveProperty("href");
      // navigation property might not be present if using default
      expect(section.navigation === undefined || typeof section.navigation === "string").toBe(true);
      expect(section).toHaveProperty("isEmpty");
      expect(section).toHaveProperty("pages");
      expect(Array.isArray(section.pages)).toBe(true);
      
      section.pages.forEach((page) => {
        expect(page).toHaveProperty("href");
        expect(page).toHaveProperty("name");
      });
    });
  });

  it("should maintain navigation property through page list generation", async () => {
    const hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    
    const pagesAndSections = await hyperbook.getPagesAndSections(hyperbookPath);
    const pageList = hyperbook.getPageList(
      pagesAndSections.sections,
      pagesAndSections.pages,
    );
    
    // Check if any sections have explicit navigation settings
    const sectionsWithNavigation = pagesAndSections.sections.filter(
      (s) => s.navigation !== undefined && s.navigation !== "default"
    );
    
    if (sectionsWithNavigation.length > 0) {
      // Verify that navigation property is preserved in page list
      sectionsWithNavigation.forEach((section) => {
        const pagesInSection = pageList.filter((p) => 
          section.pages.some((sp) => sp.href === p.href)
        );
        
        pagesInSection.forEach((page) => {
          // If section has explicit navigation, pages should inherit it or have their own
          expect(page.navigation).toBeDefined();
        });
      });
    }
  });
});
