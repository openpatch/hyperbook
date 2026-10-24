/**
 * Finds and writes the `{...}` attribute block of a directive's opening line.
 */

/** Where a directive's name ends and its attribute block, if any, sits. */
export interface AttributeBlock {
  /** Offset of `{`, or of the end of the name when there is no block. */
  start: number;
  /** Offset after `}`, or equal to start when there is no block. */
  end: number;
}

/**
 * Locates the attribute block after `name` in the directive starting at
 * `offset`. Quotes are respected, so `{title="a}b"}` ends at the right brace.
 */
export const findAttributeBlock = (
  source: string,
  offset: number,
  name: string,
): AttributeBlock | null => {
  const opening = source.slice(offset).match(/^:+/);
  if (!opening) return null;
  let i = offset + opening[0].length;
  if (source.slice(i, i + name.length) !== name) return null;
  i += name.length;

  // A container directive may have a [label] before its attributes.
  if (source[i] === "[") {
    const close = source.indexOf("]", i);
    if (close === -1) return null;
    i = close + 1;
  }
  if (source[i] !== "{") return { start: i, end: i };

  let quote: string | null = null;
  for (let j = i + 1; j < source.length; j++) {
    const c = source[j];
    if (c === "\n") return null;
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "}") {
      return { start: i, end: j + 1 };
    }
  }
  return null;
};

/**
 * Writes attributes back as `{key="value" flag}`. An empty value is a bare
 * flag, which is how `{canvas}` parses.
 */
export const formatAttributes = (
  attributes: Record<string, string | null | undefined>,
): string => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === "") {
      parts.push(key);
    } else if (value.includes('"')) {
      parts.push(`${key}='${value}'`);
    } else {
      parts.push(`${key}="${value}"`);
    }
  }
  return parts.length > 0 ? `{${parts.join(" ")}}` : "";
};
