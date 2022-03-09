import Link from "next/link";
import {
  Navigation as NavigationProps,
  Section as SectionProps,
  Page as PageProps,
} from "../utils/navigation";

type P = PageProps & Pick<NavigationProps, "current">;

const Page = ({ name, href, current }: P) => {
  return (
    <Link href={href}>
      <a className={current.href === href ? `page active` : "page"}>{name}</a>
    </Link>
  );
};

type S = SectionProps & Pick<NavigationProps, "current">;

const Section = ({ name, href, pages, sections, current }: S) => {
  return (
    <div className="section">
      <Link href={href}>
        <a className={current.href === href ? `name active` : "name"}>{name}</a>
      </Link>
      <div className="links">
        <ul className="pages">
          {pages.map((p) => (
            <Page key={p.href} {...p} current={current} />
          ))}
        </ul>
        {sections.map((s) => (
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
        {pages.map((p) => (
          <Page key={p.href} {...p} current={current} />
        ))}
      </ul>
      {sections.map((s) => (
        <Section key={s.href} {...s} current={current} />
      ))}
    </nav>
  );
};
