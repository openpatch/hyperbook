import { useLink } from "@hyperbook/provider";
import {
  HyperbookPage,
  HyperbookSection,
  Navigation as NavigationProps,
} from "@hyperbook/types";
import useCollapse from "react-collapsed";

type P = HyperbookPage & Pick<NavigationProps, "current">;

const Page = ({ name, href, current }: P) => {
  const Link = useLink();
  return (
    <li>
      <Link
        className={current?.href === href ? `page active` : "page"}
        href={href}
      >
        {name}
      </Link>
    </li>
  );
};

type S = HyperbookSection & Pick<NavigationProps, "current">;

const Section = ({
  isEmpty,
  virtual,
  name,
  href,
  pages,
  sections,
  expanded,
  current,
}: S) => {
  const Link = useLink();
  let isActive = false;
  if (current?.href && href) {
    isActive = current.href.startsWith(href);
  }
  const { getCollapseProps, getToggleProps, isExpanded } = useCollapse({
    defaultExpanded: isActive || expanded,
  });
  return (
    <div className={virtual ? "virtual-section" : "section"}>
      <div
        className={[
          "name",
          virtual || isEmpty ? "empty" : "",
          current?.href === href ? "active" : "",
        ].join(" ")}
      >
        {virtual ? null : isEmpty ? (
          <span className="label">{name}</span>
        ) : (
          <Link href={href} className="label">
            {name}
          </Link>
        )}
        {virtual ? null : (
          <button
            className="toggle"
            {...getToggleProps()}
            aria-label={isExpanded ? "Close" : "Open"}
          >
            {isExpanded ? "➖" : "➕"}
          </button>
        )}
      </div>
      <div className="links" {...(virtual ? [] : getCollapseProps())}>
        {pages.length > 0 && (
          <ul className="pages">
            {pages
              .filter((p) => !p.hide)
              .map((p) => (
                <Page key={p.href} {...p} current={current} />
              ))}
          </ul>
        )}
        {sections
          .filter((s) => !s.hide)
          .map((s) => (
            <Section key={s.href} {...s} current={current} />
          ))}
      </div>
    </div>
  );
};

export const Navigation = ({ pages, sections, current }: NavigationProps) => {
  return (
    <nav>
      <ul>
        {pages
          .filter((p) => !p.hide)
          .map((p) => (
            <Page key={p.href} {...p} current={current} />
          ))}
      </ul>
      {sections
        .filter((s) => !s.hide)
        .map((s) => (
          <Section key={s.href} {...s} current={current} />
        ))}
    </nav>
  );
};
