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

export type Language = "de" | "en" | "fr" | "es" | "it" | "pt" | "nl";

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
  repo?: string;
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
  };
};

export type LanguageString = Record<Language, string>;

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
