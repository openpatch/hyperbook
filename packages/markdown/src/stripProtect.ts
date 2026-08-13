const OPENING = /^(:{3,})protect(?:\{.*\})?\s*$/;
const CODE_FENCE = /^\s*(`{3,}|~{3,})/;

/**
 * Removes `:::protect` blocks from raw markdown.
 *
 * Exports that dump the source rather than the rendered page — llms.txt today —
 * would otherwise publish both the protected content and the `password=`
 * attribute in plaintext.
 *
 * A container directive closes with a fence of at least as many colons as it
 * opened with, which is why nesting requires more colons on the outside. That
 * rule is what makes this line scan sufficient; fenced code is skipped so
 * documentation showing the directive survives.
 */
export const stripProtectBlocks = (markdown: string): string => {
  const lines = markdown.split("\n");
  const out: string[] = [];

  let codeFence: string | null = null;
  let closing: RegExp | null = null;

  for (const line of lines) {
    if (closing) {
      if (closing.test(line)) {
        closing = null;
      }
      continue;
    }

    if (codeFence) {
      if (line.trimStart().startsWith(codeFence)) {
        codeFence = null;
      }
      out.push(line);
      continue;
    }

    const fence = line.match(CODE_FENCE);
    if (fence) {
      codeFence = fence[1];
      out.push(line);
      continue;
    }

    const opening = line.match(OPENING);
    if (opening) {
      closing = new RegExp(`^:{${opening[1].length},}\\s*$`);
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
};
