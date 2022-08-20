import { Toc as TocProps } from "../utils/toc";

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
