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
  template?: string;
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
  language?: "de" | "en" | "fr" | "es";
  repo?: string;
  links?: Link[];
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
