import { HyperbookJson } from "@hyperbook/types";
import hyperbook from "../../hyperbook.json";

export const getHyperbook = () => {
  return hyperbook as HyperbookJson;
};
