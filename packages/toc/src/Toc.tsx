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

export type TocProps = {
  headings: { level: number; label: string; anchor: string }[];
};

export const parseTocFromMarkdown = (markdown: string): TocProps => {
  const reg = /(#{1,6})\s(.*)/;
  const headings = markdown
    .split("\n")
    .filter((line) => line.match(reg))
    .map((line) => {
      const [, level, label] = line.match(reg) as RegExpMatchArray;
      const anchor = makeAnchor(label);
      return {
        level: level.length,
        label,
        anchor,
      };
    });

  return { headings };
};

export const Toc = ({ headings }: TocProps) => {
  return (
    <nav className="toc">
      <ul>
        {headings.map((h, i) => (
          <li key={i} className={`level-${h.level}`}>
            <a href={`#${h.anchor}`}>{h.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
