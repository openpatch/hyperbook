import { Nodes } from "mdast";

const emptyOptions: any = {};

export function toText(value: any, options?: any): string {
  const settings = options || emptyOptions;
  const includeImageAlt =
    typeof settings.includeImageAlt === "boolean"
      ? settings.includeImageAlt
      : true;
  const includeHtml =
    typeof settings.includeHtml === "boolean" ? settings.includeHtml : true;

  return one(value, includeImageAlt, includeHtml);
}

function one(
  value: any,
  includeImageAlt: boolean,
  includeHtml: boolean,
): string {
  if (node(value)) {
    if ("value" in value) {
      return value.type === "html" && !includeHtml ? "" : value.value;
    }

    if (includeImageAlt && "alt" in value && value.alt) {
      return value.alt;
    }

    if ("children" in value) {
      return all(value.children, includeImageAlt, includeHtml);
    }
  }

  if (Array.isArray(value)) {
    return all(value, includeImageAlt, includeHtml);
  }

  return "";
}

function all(
  values: Array<unknown>,
  includeImageAlt: boolean,
  includeHtml: boolean,
): string {
  /** @type {Array<string>} */
  const result: string[] = [];
  let index = -1;

  while (++index < values.length) {
    result[index] = one(values[index], includeImageAlt, includeHtml);
  }

  return result.join(" ");
}

function node(value: any): value is Nodes {
  return Boolean(value && typeof value === "object");
}
