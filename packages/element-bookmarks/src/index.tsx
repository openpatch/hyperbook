import { FC, ReactNode } from "react";
import { useBookmarks, useConfig, useLink } from "@hyperbook/provider";
import "./index.css";

type DirectiveBookmarksProps = {
  children?: ReactNode;
};

const DirectiveBookmarks: FC<DirectiveBookmarksProps> = ({}) => {
  const Link = useLink();
  const bookmarks = useBookmarks();
  const config = useConfig();
  const bookmarksConfig = config?.elements?.bookmarks;
  if (bookmarksConfig === false) {
    return null;
  }

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
