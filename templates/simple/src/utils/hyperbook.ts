import hb from "../../hyperbook.json";

export type Hyperbook = {
  version?: string;
  name: string;
  description?: string;
  logo?: string;
  repo?: string;
  language?: string;
  basePath?: string;
  license?: string;
  font?: string;
  fonts?: {
    heading?: string;
    body?: string;
    code?: string;
  };
  colors?: {
    brand?: string;
    brandDark?: string;
    brandText?: string;
    inverted?: boolean;
  };
  author?: {
    name: string;
    url?: string;
  };
};

export const getHyperbookUrl = (src: string): string => {
  const { basePath } = getHyperbook();
  if (
    process.env.NODE_ENV === "production" &&
    basePath &&
    src.startsWith("/")
  ) {
    if (basePath.endsWith("/")) {
      src = basePath.slice(0, -1) + src;
    } else {
      src = basePath + src;
    }
  }
  return src;
};

export const getHyperbook = () => {
  return hb as Hyperbook;
};

export const getHyperbookLangCode = (): string => {
  const { language } = getHyperbook();

  if (language == "de") {
    return "de-DE";
  }

  return "en";
};
