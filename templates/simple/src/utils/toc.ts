const makeAnchor = (heading: string) => {
  // If we have a heading, make it lower case
  let anchor = heading.toLowerCase();

  // Clean anchor (replace special characters whitespaces).
  // Alternatively, use encodeURIComponent() if you don't care about
  // pretty anchor links
  anchor = anchor.replace(/[^a-zA-Z0-9 ]/g, "");
  anchor = anchor.replace(/ /g, "-");

  return anchor;
};

export type Toc = {
  headings: { level: number; label: string; anchor: string }[];
};

export const getToc = (markdown: string): Toc => {
  const headings = markdown
    .split("\n")
    .filter((line) => line.match(/^\s*#{1,3}\s/))
    .map((line) => {
      const [, level, label] = line.match(/(#{1,3})\s(.*)/);
      const anchor = makeAnchor(label);
      return {
        level: level.length,
        label,
        anchor,
      };
    });

  return { headings };
};
