import { FC, ReactNode } from "react";
import { useBookmarks, useLink } from "@hyperbook/provider";
import "./index.css";

type DirectiveBookmarksProps = {
  children?: ReactNode;
};

const DirectiveBookmarks: FC<DirectiveBookmarksProps> = ({}) => {
  const Link = useLink();
  const bookmarks = useBookmarks();

  return (
    <ul className="element-bookmarks">
      {bookmarks.map((bookmark) => (
        <li key={bookmark.href}>
          <Link href={bookmark.href}>{bookmark.label}</Link>
        </li>
      ))}
    </ul>
  );
};

export default {
  directives: { bookmarks: DirectiveBookmarks },
};
