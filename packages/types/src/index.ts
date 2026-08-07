type ElementConfig = {
  version?: string;
};

export type Script =
  | string
  | {
      type?: "module" | "plain/text";
      src: string;
      crossorigin?: boolean;
      position: "head" | "body";
      versioned?: boolean;
    };

export type LinkWithLinks = {
  label: string;
  icon?: string;
  links: Link[];
};

export type LinkWithHref = {
  label: string;
  icon?: string;
  href: string;
};

export type Link = LinkWithHref | LinkWithLinks;

export type Navigation = {
  next: HyperbookPage | null;
  previous: HyperbookPage | null;
  current: HyperbookPage | null;
  pages: HyperbookPage[];
  sections: HyperbookSection[];
  glossary: HyperbookPage[];
};

export type Term = {
  name: string;
  href: string;
};

export type Glossary = Record<string, Term[]>;

export type Language = "de" | "en" | "fr" | "es" | "it" | "pt" | "nl";

export type Layout = "default" | "wide" | "standalone";

export type BreadcrumbConfig = {
  home?: string;
  separator?: string;
};

export type PageNavigation = "default" | "hidden";

export type SectionNavigation =
  | "default"
  | "hidden"
  | "virtual"
  | "page"
  | "expanded";

export type HyperbookPageFrontmatter = {
  name: string;
  title?: string;
  permaid?: string;
  lang?: Language;
  qrcode?: boolean;
  description?: string;
  keywords?: string[];
  scripts?: string[];
  styles?: string[];
  index?: number;
  hide?: boolean;
  toc?: boolean;
  next?: string;
  prev?: string;
  layout?: Layout;
  breadcrumb?: boolean | BreadcrumbConfig;
  navigation?: PageNavigation;
};

export type HyperbookSectionFrontmatter = Omit<
  HyperbookPageFrontmatter,
  "navigation"
> & {
  virtual?: boolean;
  expanded?: boolean;
  navigation?: SectionNavigation;
};

export type HyperbookPage = HyperbookPageFrontmatter & {
  isEmpty?: boolean;
  href?: string;
  path?: {
    directory: string;
    relative: string;
    absolute: string;
    href: string | null;
    permalink: string | null;
  };
  repo?: string;
};

export type HyperbookSection = HyperbookSectionFrontmatter & {
  isEmpty?: boolean;
  href?: string;
  pages: HyperbookPage[];
  sections: HyperbookSection[];
  repo?: string;
};

export type HyperbookFrontmatter =
  | HyperbookPageFrontmatter
  | HyperbookSectionFrontmatter;

export type HyperbookJson = {
  name: string;
  description?: string;
  logo?: string;
  allowDangerousHtml?: boolean;
  trailingSlash?: boolean;
  importExport?: boolean;
  search?: boolean;
  qrcode?: boolean;
  toc?: boolean;
  llms?: boolean;
  breadcrumb?: boolean | BreadcrumbConfig;
  author?: {
    name?: string;
    url?: string;
  };
  /**
   * Controls how the Hyperbook version is displayed.
   * - "text": Shows version below the "Powered by Hyperbook" label.
   * - "tooltip": Shows version on hover of the "Powered by Hyperbook" label.
   * - "console": Outputs version as ASCII art in the browser console (default).
   */
  version?: "text" | "tooltip" | "console";
  font?: string;
  fonts?: {
    heading?: string;
    body?: string;
    code?: string;
  };
  scripts?: string[];
  styles?: string[];
  colors?: {
    /**
     * @format color-hex
     */
    brand?: string;
    /**
     * @format color-hex
     */
    brandDark?: string;
    /**
     * @format color-hex
     */
    brandText?: string;
    inverted?: boolean;
  };
  basePath?: string;
  /**
   * Where the assets of a hyperbook are served from. Assets are the stylesheets
   * and the scripts of the elements you use, and they are copied into your
   * build by default.
   */
  assets?: {
    /**
     * Elements whose assets are served from a CDN instead of being copied into
     * your build. Name them the way you write them, for example "onlineide",
     * "sqlide" or "emoji". The heavy ones are worth naming here; a build that
     * copies none of them is a fraction of the size.
     *
     * An element served this way needs the network to work, so leave one out
     * to keep it working offline.
     */
    cdn?: string[];
    /**
     * Where those assets are served from. Defaults to jsDelivr, pinned to the
     * version of hyperbook that built your pages, so the assets always match
     * the pages that ask for them. Set it to serve them from your own mirror.
     */
    cdnUrl?: string;
  };
  license?: string;
  language?: Language;
  repo?:
    | string
    | {
        url: string;
        label: string;
      };
  links?: Link[];
  cloud?: {
    url: string;
    id: string;
  };
  elements?: {
    bookmarks?: false | ElementConfig;
    code?: ElementConfig & {
      theme?:
        | {
            dark: string;
            light: string;
          }
        | string;
      bypassInline?: boolean;
      showLineNumbers?: boolean;
    };
    excalidraw?: ElementConfig & {
      autoZoom?: boolean;
      center?: boolean;
      aspectRatio?: string;
      edit?: boolean;
    };
    onlineide?: ElementConfig & {
      height?: string | number;
    };
    kirimoto?: ElementConfig & {
      height?: string;
      settings?: string;
    };
    sqlide?: ElementConfig & {
      db?: string;
      height?: string | number;
    };
    emoji?: ElementConfig & {
      /**
       * How emojis are rendered.
       * - "native": Emojis are kept as text and drawn with the emoji font of
       *   the reader's operating system (default).
       * - "twemoji": Emojis are replaced with Twemoji images, so they look the
       *   same on every platform.
       */
      style?: "native" | "twemoji";
    };
  };
};

export type LanguageString = Partial<Record<Language, string>>;

export type HyperlibraryJson = {
  name: string | LanguageString;
  library: {
    src: string;
    basePath: string;
    icon?: string;
    name?: string | LanguageString;
  }[];
  basePath?: string;
};

export type Hyperproject = {
  name: string | LanguageString;
  basePath?: string;
  icon?: string;
  src: string;
} & ({ type: "book" } | { type: "library"; projects: Hyperproject[] });

export interface HyperbookContext {
  root: string;
  config: HyperbookJson;
  library?: HyperlibraryJson;
  project?: Hyperproject;
  version?: string;
  makeUrl(
    path: string | string[],
    base: "public" | "book" | "archive" | "glossary" | "assets",
    page?: HyperbookPage,
    options?: {
      versioned?: boolean;
      /**
       * The asset is written by the build for this hyperbook, like its search
       * index or its translations, so it comes from the build itself even when
       * the rest are served from somewhere else.
       */
      local?: boolean;
    },
  ): string;
  navigation: Navigation;
  /**
   * Collects absolute paths of files inlined into the page while it is being
   * processed, so the dev server can rebuild exactly the pages that used them.
   * Only set during a build that tracks dependencies.
   */
  dependencies?: Set<string>;
  /**
   * Contents of the files a page inlines, read before it is processed. A
   * directive that inlines its `src` runs synchronously and cannot read a file
   * itself where the host has no synchronous file system, so it looks here.
   */
  files?: Map<string, string>;
}

/** One entry of a navigation level, either a page or a section. */
export type NavigationEntry =
  | { type: "page"; page: HyperbookPage }
  | { type: "section"; section: HyperbookSection };

/**
 * Pages and sections without an index keep their old order, pages first. A
 * section that is shown as a page is one of the pages here, because that is
 * how it is rendered.
 */
const FALLBACK_INDEX_PAGE = 9999;
const FALLBACK_INDEX_SECTION = 10000;

const isShownAsPage = (section: HyperbookSection): boolean =>
  section.navigation === "page";

/**
 * Brings the pages and the sections of one navigation level into a single
 * order. `index` decides, across both of them, so a section can sit between
 * two pages. Entries without an `index` fall back to pages before sections,
 * and entries that end up equal are ordered by name.
 *
 * Both lists are expected to be in order already, which is what reading a
 * hyperbook gives. They are merged rather than sorted, so the order a caller
 * built stays intact and only the two lists are woven together.
 */
export const sortNavigation = (
  pages: HyperbookPage[],
  sections: HyperbookSection[],
): NavigationEntry[] => {
  const pageKey = (page: HyperbookPage) => ({
    index: page.index ?? FALLBACK_INDEX_PAGE,
    kind: 0,
    name: page.name,
  });
  const sectionKey = (section: HyperbookSection) => ({
    index:
      section.index ??
      (isShownAsPage(section) ? FALLBACK_INDEX_PAGE : FALLBACK_INDEX_SECTION),
    kind: isShownAsPage(section) ? 0 : 1,
    name: section.name,
  });

  const entries: NavigationEntry[] = [];
  let p = 0;
  let s = 0;

  while (p < pages.length || s < sections.length) {
    if (s >= sections.length) {
      entries.push({ type: "page", page: pages[p++] });
      continue;
    }
    if (p >= pages.length) {
      entries.push({ type: "section", section: sections[s++] });
      continue;
    }

    const page = pageKey(pages[p]);
    const section = sectionKey(sections[s]);
    const takePage =
      page.index !== section.index
        ? page.index < section.index
        : page.kind !== section.kind
          ? page.kind < section.kind
          : page.name <= section.name;

    if (takePage) {
      entries.push({ type: "page", page: pages[p++] });
    } else {
      entries.push({ type: "section", section: sections[s++] });
    }
  }

  return entries;
};

/**
 * Matches a URI scheme at the start of a string, as defined by RFC 3986.
 * This covers `https://` and `data:` as well as schemes without an authority
 * like `mailto:`, `tel:` or `sms:`.
 */
const URL_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/**
 * Checks whether a path is an absolute URL and therefore must be passed
 * through untouched by `makeUrl`, instead of being resolved against the
 * hyperbook's base path.
 */
export const isExternalUrl = (path: string): boolean => URL_SCHEME.test(path);
