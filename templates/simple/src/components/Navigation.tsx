import Link from "next/link";
import {
  Navigation as NavigationProps,
  Section as SectionProps,
  Page as PageProps,
} from "../utils/navigation";

type P = PageProps & Pick<NavigationProps, "current">;

const Page = ({ name, href, current }: P) => {
  return (
    <li>
      <Link href={href}>
        <a className={current?.href === href ? `page active` : "page"}>
          {name}
        </a>
      </Link>
    </li>
  );
};

type S = SectionProps & Pick<NavigationProps, "current">;

const Section = ({
  isEmpty,
  virtual,
  name,
  href,
  pages,
  sections,
  current,
}: S) => {
  return (
    <div className={virtual ? "" : "section"}>
      {virtual ? null : isEmpty ? (
        <span className="name empty">{name}</span>
      ) : (
        <Link href={href}>
          <a className={current?.href === href ? `name active` : "name"}>
            {name}
          </a>
        </Link>
      )}
      <div className="links">
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
