type ElementConfig = {
  version?: string;
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

export type HyperbookPageFrontmatter = {
  name: string;
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
};

export type HyperbookSectionFrontmatter = HyperbookPageFrontmatter & {
  virtual?: boolean;
  expanded?: boolean;
};

export type HyperbookPage = HyperbookPageFrontmatter & {
  isEmpty?: boolean;
  href?: string;
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
  author?: {
    name?: string;
    url?: string;
  };
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
  license?: string;
  language?: Language;
  repo?:
    | string
    | {
        url: string;
        label: string;
      };
  links?: Link[];
  elements?: {
    bookmarks?: false | ElementConfig;
    code?: ElementConfig & {
      theme?:
        | {
            dark: string;
            light: string;
          }
        | string;
      showLineNumbers?: boolean;
    };
    excalidraw?: ElementConfig & {
      autoZoom?: boolean;
      center?: boolean;
      aspectRation?: string;
      edit?: boolean;
    };
    onlineide?: ElementConfig & {
      url?: string;
      height?: string | number;
    };
    sqlide?: ElementConfig & {
      url?: string;
      db?: string;
      height?: string | number;
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
  makeUrl(
    path: string | string[],
    base: "public" | "book" | "archive" | "glossary" | "assets",
  ): string;
  navigation: Navigation;
}
