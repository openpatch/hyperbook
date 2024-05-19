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
};

export type Term = {
  name: string;
  href: string;
};

export type Glossary = Record<string, Term[]>;

export type Language = "de" | "en" | "fr" | "es" | "it" | "pt" | "nl";

export type HyperbookPageFrontmatter = {
  name: string;
  lang?: Language;
  description?: string;
  keywords?: string[];
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
  template?: string;
  elements?: {
    bookmarks?: false | ElementConfig;
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
