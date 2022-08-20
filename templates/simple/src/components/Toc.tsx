import { Toc as TocProps } from "../utils/toc";

export const Toc = ({ headings }: TocProps) => {
  return (
    <nav className="toc">
      <ul>
        {headings.map((h) => (
          <li key={h.anchor} className={`level-${h.level}`}>
            <a href={`#${h.anchor}`}>{h.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
};
