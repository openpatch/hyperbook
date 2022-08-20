import { makeAnchor } from "../components/Headings";

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
