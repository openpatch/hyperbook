/**
 * Text edits by offset. A migration never re-prints the Markdown -- that would
 * reformat the whole page and break Handlebars -- it replaces exact ranges and
 * leaves every other byte alone.
 */
export interface Edit {
  start: number;
  end: number;
  text: string;
}

export interface Note {
  line?: number;
  message: string;
}

/**
 * Applies edits from the end of the text backwards, so earlier offsets stay
 * valid. Overlapping edits are a bug in the migration, not something to
 * resolve here.
 */
export const applyEdits = (source: string, edits: Edit[]): string => {
  const sorted = [...edits].sort((a, b) => b.start - a.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].end > sorted[i - 1].start) {
      throw new Error(
        `Overlapping edits at ${sorted[i].start}-${sorted[i].end} and ${sorted[i - 1].start}-${sorted[i - 1].end}`,
      );
    }
  }
  let out = source;
  for (const edit of sorted) {
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  }
  return out;
};

/**
 * Blanks the front matter so a Markdown parser does not read it as content,
 * keeping every offset after it unchanged.
 */
export const blankFrontmatter = (source: string): string => {
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/);
  if (!match) return source;
  return match[0].replace(/[^\n]/g, " ") + source.slice(match[0].length);
};
