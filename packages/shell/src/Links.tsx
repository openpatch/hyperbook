import { RefObject, useLayoutEffect, useState } from "react";
import { useLink } from "@hyperbook/provider";
import {
  HyperbookJson,
  LinkWithLinks as LinkWithLinksProps,
  LinkWithHref as LinkWithHrefProps,
  Link as LinkProps,
} from "@hyperbook/types";
import { Menu, MenuItem, SubMenu, MenuButton } from "@szhsin/react-menu";
import { Fragment, FC, useRef } from "react";

export const useOnScreen = <T extends HTMLElement>(
  ref: RefObject<T>,
  containerRef: RefObject<T>,
  padding: number = 0
) => {
  const [isOnScreen, setOnScreen] = useState(true);

  const handleResize = (bounds: DOMRect) => () => {
    if (containerRef.current) {
      const containerBounds = containerRef.current.getBoundingClientRect();

      if (
        containerBounds.width >= bounds.width + padding &&
        containerBounds.right <= window.innerWidth
      ) {
        setOnScreen(true);
      } else {
        setOnScreen(false);
      }
    }
  };

  useLayoutEffect(() => {
    if (ref.current) {
      const bounds = ref.current.getBoundingClientRect();

      const h = handleResize(bounds);

      window.addEventListener("resize", h);

      h();

      return () => {
        window.removeEventListener("resize", h);
      };
    }
  }, [ref]);

  return isOnScreen;
};

export type LinksProps = { links: HyperbookJson["links"] };

const Item: FC<Pick<LinkProps, "label" | "icon">> = ({ label, icon }) => {
  return (
    <Fragment>
      {icon && <div className="icon">{icon}</div>}
      <div className="label">{label}</div>
    </Fragment>
  );
};

const LinkWithLinks: FC<LinkWithLinksProps> = ({ label, links, icon }) => {
  return (
    <SubMenu label={<Item label={label} icon={icon} />}>
      {links.map((l, i) => (
        <Link key={i} {...l} />
      ))}
    </SubMenu>
  );
};

const LinkWithHref: FC<LinkWithHrefProps> = ({ label, icon, href }) => {
  return (
    <MenuItem href={href}>
      <Item label={label} icon={icon} />
    </MenuItem>
  );
};

const Link: FC<LinkProps> = (link) => {
  if ("links" in link) {
    return <LinkWithLinks {...link} />;
  } else {
    return <LinkWithHref {...link} />;
  }
};

const MenuLink: FC<LinkWithHrefProps> = ({ label, href, icon }) => {
  const Link = useLink();
  return (
    <Link className="szh-menu-link" href={href}>
      <Item label={label} icon={icon} />
    </Link>
  );
};

export const Links: FC<LinksProps> = ({ links }) => {
  const linkRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isVisible = useOnScreen(linkRef, containerRef);
  return (
    <div className="custom-links" ref={containerRef}>
      {!isVisible ? (
        <Menu
          menuButton={
            <MenuButton className="icon">
              <svg
                focusable="false"
                aria-hidden="true"
                viewBox="0 0 24 24"
                data-testid="MoreVertIcon"
              >
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"></path>
              </svg>
            </MenuButton>
          }
          transition
        >
          {links?.map((link, i) => (
            <Link {...link} key={i} />
          ))}
        </Menu>
      ) : (
        <div className="container" ref={linkRef}>
          {links?.map((link, i) => {
            if ("links" in link) {
              return (
                <Menu
                  key={i}
                  menuButton={
                    <MenuButton>
                      <Item {...link} />
                    </MenuButton>
                  }
                  transition
                >
                  {link.links?.map((link, i) => (
                    <Link {...link} key={i} />
                  ))}
                </Menu>
              );
            } else {
              return <MenuLink key={i} {...link} />;
            }
          })}
        </div>
      )}
    </div>
  );
};
