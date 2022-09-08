import { Components } from "react-markdown";
import { useBookmark } from "../store";

export const makeAnchor = (heading: string) => {
  // If we have a heading, make it lower case
  let anchor = heading.toLowerCase();

  // Clean anchor (replace special characters whitespaces).
  // Alternatively, use encodeURIComponent() if you don't care about
  // pretty anchor links
  anchor = anchor.replace(/[^a-zA-Z0-9 ]/g, "");
  anchor = anchor.replace(/ /g, "-");

  return anchor;
};

export const Headings: Components["h1"] = ({ level, children }) => {
  // Access actual (string) value of heading
  const heading = children[0];

  // If we have a heading, make it lower case
  let anchor = typeof heading === "string" ? makeAnchor(heading) : "";

  const label = typeof heading === "string" ? heading : anchor;

  const [bookmark, toggleBookmark] = useBookmark(anchor, label);

  // Utility
  const container = (children: React.ReactNode): JSX.Element => (
    <>
      <a className="heading" id={anchor} href={`#${anchor}`}>
        <span>{children}</span>
      </a>
      <button
        className={bookmark ? "bookmark active" : "bookmark"}
        onClick={() => toggleBookmark()}
        title="Bookmark"
      >
        🔖
      </button>
    </>
  );

  switch (level) {
    case 1:
      return <h1>{container(children)}</h1>;
    case 2:
      return <h2>{container(children)}</h2>;
    case 3:
      return <h3>{container(children)}</h3>;
    case 4:
      return <h4>{container(children)}</h4>;
    case 5:
      return <h5>{container(children)}</h5>;

    default:
      return <h6>{container(children)}</h6>;
  }
};
