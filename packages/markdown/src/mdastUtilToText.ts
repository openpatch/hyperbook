import { Nodes } from "mdast";

const emptyOptions: any = {};

export type ToTextOptions = {
  includeImageAlt?: boolean;
  includeHtml?: boolean;
  /** Subtrees for which this returns true contribute no text. */
  skip?: (node: any) => boolean;
};

export function toText(value: any, options?: ToTextOptions): string {
  const settings = options || emptyOptions;
  const includeImageAlt =
    typeof settings.includeImageAlt === "boolean"
      ? settings.includeImageAlt
      : true;
  const includeHtml =
    typeof settings.includeHtml === "boolean" ? settings.includeHtml : true;

  return one(value, includeImageAlt, includeHtml, settings.skip);
}

function one(
  value: any,
  includeImageAlt: boolean,
  includeHtml: boolean,
  skip?: (node: any) => boolean,
): string {
  if (node(value)) {
    if (skip && skip(value)) {
      return "";
    }

    if ("value" in value) {
      return value.type === "html" && !includeHtml ? "" : value.value;
    }

    if (includeImageAlt && "alt" in value && value.alt) {
      return value.alt;
    }

    if ("children" in value) {
      return all(value.children, includeImageAlt, includeHtml, skip);
    }
  }

  if (Array.isArray(value)) {
    return all(value, includeImageAlt, includeHtml, skip);
  }

  return "";
}

function all(
  values: Array<unknown>,
  includeImageAlt: boolean,
  includeHtml: boolean,
  skip?: (node: any) => boolean,
): string {
  /** @type {Array<string>} */
  const result: string[] = [];
  let index = -1;

  while (++index < values.length) {
    result[index] = one(values[index], includeImageAlt, includeHtml, skip);
  }

  return result.join(" ");
}

function node(value: any): value is Nodes {
  return Boolean(value && typeof value === "object");
}
