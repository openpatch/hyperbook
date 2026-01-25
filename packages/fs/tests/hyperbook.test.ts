import path from "path";
import { describe, it, expect } from "vitest";
import { hyperbook, vfile } from "../src";
import { HyperbookPage } from "@hyperbook/types/dist";

describe("hyperbook", () => {
  const relative = (s: string) =>
    path.relative(path.join(__dirname, "fixtures"), s);
  const makeFileRelative = (p: HyperbookPage) => {
    return {
      ...p,
      path: { ...p.path, absolute: relative(p.path?.absolute || "") },
    } as HyperbookPage;
  };
  it("should get navigation", async () => {
    let hyperbookPath = path.join(__dirname, "fixtures", "single-hyperbook");
    let files = await vfile.list(hyperbookPath);
    let current = files.find(
      (f) => f.name === "paradigms" && f.folder === "book",
    );
    if (!current) {
      throw Error("Missing file");
    }
    const pagesAndSections = await hyperbook.getPagesAndSections(hyperbookPath);
    const pageList = hyperbook.getPageList(
      pagesAndSections.sections,
      pagesAndSections.pages,
    );
    const navigation = await hyperbook.getNavigationForFile(
      pageList.map(makeFileRelative),
      current,
    );
    expect(navigation).toMatchSnapshot();
  });

  describe("getNavigationForFile", () => {
    it("should return null values when no currentFile is provided", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1" },
        { name: "Page 2", href: "/page2" },
      ];
      
      const navigation = await hyperbook.getNavigationForFile(pageList);
      
      expect(navigation.current).toBeNull();
      expect(navigation.next).toBeNull();
      expect(navigation.previous).toBeNull();
    });

    it("should return null current when currentFile is not in pageList", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1" },
        { name: "Page 2", href: "/page2" },
      ];
      const currentFile = {
        name: "nonexistent",
        path: { href: "/nonexistent" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.current).toBeNull();
      // When index is -1, next is pageList[0] and previous is pageList[-2] which is undefined
      expect(navigation.next).toEqual(pageList[0]);
      expect(navigation.previous).toBeNull();
    });

    it("should find correct navigation for first page", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1" },
        { name: "Page 2", href: "/page2" },
        { name: "Page 3", href: "/page3" },
      ];
      const currentFile = {
        path: { href: "/page1" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.current).toEqual(pageList[0]);
      expect(navigation.next).toEqual(pageList[1]);
      expect(navigation.previous).toBeNull();
    });

    it("should find correct navigation for middle page", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1" },
        { name: "Page 2", href: "/page2" },
        { name: "Page 3", href: "/page3" },
      ];
      const currentFile = {
        path: { href: "/page2" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.current).toEqual(pageList[1]);
      expect(navigation.next).toEqual(pageList[2]);
      expect(navigation.previous).toEqual(pageList[0]);
    });

    it("should find correct navigation for last page", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1" },
        { name: "Page 2", href: "/page2" },
        { name: "Page 3", href: "/page3" },
      ];
      const currentFile = {
        path: { href: "/page3" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.current).toEqual(pageList[2]);
      expect(navigation.next).toBeNull();
      expect(navigation.previous).toEqual(pageList[1]);
    });

    it("should skip hidden pages in navigation", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1" },
        { name: "Hidden", href: "/hidden", hide: true },
        { name: "Page 3", href: "/page3" },
      ];
      const currentFile = {
        path: { href: "/page1" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.next?.href).toBe("/page3");
    });

    it("should skip empty pages in navigation (except current page)", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1" },
        { name: "Empty", href: "/empty", isEmpty: true },
        { name: "Page 3", href: "/page3" },
      ];
      const currentFile = {
        path: { href: "/page1" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.next?.href).toBe("/page3");
    });

    it("should include current page even if empty", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1" },
        { name: "Empty", href: "/empty", isEmpty: true },
        { name: "Page 3", href: "/page3" },
      ];
      const currentFile = {
        path: { href: "/empty" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.current?.href).toBe("/empty");
      expect(navigation.previous?.href).toBe("/page1");
      expect(navigation.next?.href).toBe("/page3");
    });

    it("should use custom next link when specified (absolute path)", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1", next: "/page3" },
        { name: "Page 2", href: "/page2" },
        { name: "Page 3", href: "/page3" },
      ];
      const currentFile = {
        path: { href: "/page1" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.current).toEqual(pageList[0]);
      expect(navigation.next).toEqual(pageList[2]); // Skip page2, go to page3
    });

    it("should use custom prev link when specified (absolute path)", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1" },
        { name: "Page 2", href: "/page2" },
        { name: "Page 3", href: "/page3", prev: "/page1" },
      ];
      const currentFile = {
        path: { href: "/page3" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.current).toEqual(pageList[2]);
      expect(navigation.previous).toEqual(pageList[0]); // Skip page2, go to page1
    });

    it("should resolve permaid links (/@/ syntax)", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1", permaid: "intro", next: "/@/advanced" },
        { name: "Page 2", href: "/page2", permaid: "basics" },
        { name: "Page 3", href: "/page3", permaid: "advanced" },
      ];
      const currentFile = {
        path: { href: "/page1" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.next?.permaid).toBe("advanced");
      expect(navigation.next?.href).toBe("/page3");
    });

    it("should resolve relative links (./ syntax)", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/section/page1", next: "./page2" },
        { name: "Page 2", href: "/section/page2" },
        { name: "Page 3", href: "/page3" },
      ];
      const currentFile = {
        path: { href: "/section/page1" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.next?.href).toBe("/section/page2");
    });

    it("should resolve parent relative links (../ syntax)", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/section/subsection/page1", next: "../page2" },
        { name: "Page 2", href: "/section/page2" },
        { name: "Page 3", href: "/page3" },
      ];
      const currentFile = {
        path: { href: "/section/subsection/page1" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.next?.href).toBe("/section/page2");
    });

    it("should return null when custom link cannot be resolved", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1", next: "/nonexistent" },
        { name: "Page 2", href: "/page2" },
      ];
      const currentFile = {
        path: { href: "/page1" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.next).toBeNull();
    });

    it("should handle permaid link with whitespace", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Page 1", href: "/page1", next: "/@/ advanced " },
        { name: "Page 2", href: "/page2", permaid: "advanced" },
      ];
      const currentFile = {
        path: { href: "/page1" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.next?.permaid).toBe("advanced");
    });

    it("should handle single page scenario", async () => {
      const pageList: HyperbookPage[] = [
        { name: "Only Page", href: "/only" },
      ];
      const currentFile = {
        path: { href: "/only" },
      } as any;
      
      const navigation = await hyperbook.getNavigationForFile(pageList, currentFile);
      
      expect(navigation.current).toEqual(pageList[0]);
      expect(navigation.next).toBeNull();
      expect(navigation.previous).toBeNull();
    });
  });

  describe("getPageList", () => {
    it("should place section index page first for non-virtual sections", () => {
      const sections: any[] = [
        {
          name: "Normal Section",
          href: "/section",
          virtual: false,
          navigation: "default",
          pages: [
            { name: "Page A", href: "/section/page-a" },
            { name: "Section Index", href: "/section" },
            { name: "Page B", href: "/section/page-b" },
          ],
          sections: [],
        },
      ];
      const pages: any[] = [];

      const pageList = hyperbook.getPageList(sections, pages);

      expect(pageList[0].href).toBe("/section");
      expect(pageList[1].href).toBe("/section/page-a");
      expect(pageList[2].href).toBe("/section/page-b");
    });

    it("should not reorder pages for virtual sections", () => {
      const sections: any[] = [
        {
          name: "Virtual Section",
          href: "/virtual",
          virtual: true,
          pages: [
            { name: "Page A", href: "/virtual/page-a" },
            { name: "Index", href: "/virtual" },
            { name: "Page B", href: "/virtual/page-b" },
          ],
          sections: [],
        },
      ];
      const pages: any[] = [];

      const pageList = hyperbook.getPageList(sections, pages);

      expect(pageList[0].href).toBe("/virtual/page-a");
      expect(pageList[1].href).toBe("/virtual");
      expect(pageList[2].href).toBe("/virtual/page-b");
    });

    it("should place section index first when navigation is virtual", () => {
      const sections: any[] = [
        {
          name: "Virtual Nav Section",
          href: "/virt-nav",
          navigation: "virtual",
          pages: [
            { name: "Page A", href: "/virt-nav/page-a" },
            { name: "Index", href: "/virt-nav" },
          ],
          sections: [],
        },
      ];
      const pages: any[] = [];

      const pageList = hyperbook.getPageList(sections, pages);

      // Virtual navigation should not reorder
      expect(pageList[0].href).toBe("/virt-nav/page-a");
      expect(pageList[1].href).toBe("/virt-nav");
    });

    it("should handle sections without href", () => {
      const sections: any[] = [
        {
          name: "No Href Section",
          pages: [
            { name: "Page A", href: "/section/page-a" },
            { name: "Page B", href: "/section/page-b" },
          ],
          sections: [],
        },
      ];
      const pages: any[] = [];

      const pageList = hyperbook.getPageList(sections, pages);

      expect(pageList[0].href).toBe("/section/page-a");
      expect(pageList[1].href).toBe("/section/page-b");
    });

    it("should handle nested sections correctly", () => {
      const sections: any[] = [
        {
          name: "Parent Section",
          href: "/parent",
          pages: [
            { name: "Parent Index", href: "/parent" },
          ],
          sections: [
            {
              name: "Child Section",
              href: "/parent/child",
              pages: [
                { name: "Child Page", href: "/parent/child/page" },
                { name: "Child Index", href: "/parent/child" },
              ],
              sections: [],
            },
          ],
        },
      ];
      const pages: any[] = [];

      const pageList = hyperbook.getPageList(sections, pages);

      expect(pageList[0].href).toBe("/parent");
      expect(pageList[1].href).toBe("/parent/child");
      expect(pageList[2].href).toBe("/parent/child/page");
    });
  });
});
