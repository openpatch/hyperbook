import { HyperbookJson } from "@hyperbook/types";
import hb from "../../hyperbook.json";

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
  return hb as HyperbookJson;
};

export const getHyperbookLangCode = (): string => {
  const { language } = getHyperbook();

  if (language == "de") {
    return "de-DE";
  }

  return "en";
};
