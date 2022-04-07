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
  colors?: {
    brand?: string;
    brandText?: string;
    inverted?: boolean;
  };
  author?: {
    name: string;
    url?: string;
  };
};

export const getHyperbook = () => {
  return hb as Hyperbook;
};
