import { useLink, useMakeUrl, useHead, useConfig } from "@hyperbook/provider";
import { FC, Fragment, ReactNode, useEffect, useState } from "react";
import { Toc, TocProps } from "@hyperbook/toc";
import { Navigation as NavigationProps, HyperbookPage } from "@hyperbook/types";
import { Drawer } from "./Drawer";
import { Links } from "./Links";
import { Navigation } from "./Navigation";

export type ShellProps = {
  navigation?: NavigationProps;
  toc?: TocProps;
  children?: ReactNode;
};

const linkLicense = (license: string) => {
  const Link = useLink();
  let href: string | null = null;
  let label: string | null = null;
  switch (license.toLowerCase()) {
    case "cc0": {
      href = "https://creativecommons.org/publicdomain/zero/1.0/";
      label = "CC0";
      break;
    }
    case "cc-by": {
      href = "https://creativecommons.org/licenses/by/4.0";
      label = "CC BY";
      break;
    }
    case "cc-by-sa": {
      href = "https://creativecommons.org/licenses/by-sa/4.0";
      label = "CC BY-SA";
      break;
    }
    case "cc-by-nd": {
      href = "https://creativecommons.org/licenses/by-nd/4.0";
      label = "CC BY-ND";
      break;
    }
    case "cc-by-nc": {
      href = "https://creativecommons.org/licenses/by-nc/4.0";
      label = "CC BY-NC";
      break;
    }
    case "cc-by-nc-sa": {
      href = "https://creativecommons.org/licenses/by-nc-sa/4.0";
      label = "CC BY-NC-SA";
      break;
    }
    case "cc-by-nc-nd": {
      href = "https://creativecommons.org/licenses/by-nc-nd/4.0";
      label = "CC BY-NC-ND";
      break;
    }
  }

  if (href) {
    return (
      <Link href={href} rel="license">
        Licensed under {label}
      </Link>
    );
  }

  return license;
};

export const Shell: FC<ShellProps> = ({ toc, navigation, children }) => {
  const Link = useLink();
  const Head = useHead();
  const hyperbook = useConfig();
  const page = navigation?.current;
  const makeUrl = useMakeUrl();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);

  useEffect(() => {
    const appHeight = () => {
      const doc = document.documentElement;
      doc.style.setProperty(`--app-height`, `${window.innerHeight}px`);
    };

    appHeight();

    window.addEventListener("resize", appHeight);

    return () => {
      window.removeEventListener("resize", appHeight);
    };
  }, []);
  return (
    <Fragment>
      {page && (
        <Head>
          <title>{`${page.name} - ${hyperbook.name}`}</title>
          <meta
            property="og:title"
            content={`${page.name} - ${hyperbook.name}`}
            key="title"
          />
          {hyperbook.description && (
            <>
              <meta name="description" content={hyperbook.description} />
              <meta name="og:description" content={hyperbook.description} />
            </>
          )}
          {page.description && (
            <>
              <meta name="description" content={page.description} />
              <meta name="og:description" content={page.description} />
            </>
          )}
          {page.keywords && (
            <meta name="keywords" content={page.keywords.join(",")} />
          )}
        </Head>
      )}
      <div className="main-grid">
        <header
          className={hyperbook?.colors?.inverted ? "inverted" : undefined}
        >
          <div className="mobile-nav">
            <button
              aria-label="Nav Toggle"
              className={isNavOpen ? "toggle change" : "toggle"}
              onClick={() => setIsNavOpen(!isNavOpen)}
            >
              <div className="bar1"></div>
              <div className="bar2"></div>
              <div className="bar3"></div>
            </button>
            <Drawer
              isOpen={isNavOpen}
              onClose={() => setIsNavOpen(false)}
              position="left"
            >
              <div id="mobile-sidebar">
                {navigation && <Navigation {...navigation} />}
                <a className="author" href="https://hyperbook.openpatch.org">
                  Powered by <b>Hyperbook</b>
                </a>
              </div>
            </Drawer>
          </div>
          <Link className="branding" href="/">
            {hyperbook.logo && (
              <div className="logo">
                <img alt="Logo" src={makeUrl(hyperbook.logo, "public")} />
              </div>
            )}
            <div className="name">{hyperbook.name}</div>
          </Link>
          {hyperbook.links && <Links links={hyperbook.links}></Links>}
        </header>
        <div className="sidebar">
          {navigation && <Navigation {...navigation} />}
          <a className="author" href="https://hyperbook.openpatch.org">
            Powered by <b>Hyperbook</b>
          </a>
        </div>
        {toc && (
          <Fragment>
            <button
              className={isTocOpen ? "toc-toggle open" : "toc-toggle"}
              onClick={() => setIsTocOpen(!isTocOpen)}
              title="Table of Contents"
            >
              <div className="bar1"></div>
              <div className="bar2"></div>
              <div className="bar3"></div>
              <div className="bar4"></div>
            </button>
            <Drawer
              isOpen={isTocOpen}
              onClose={() => setIsTocOpen(false)}
              position="right"
            >
              <div id="toc-sidebar">
                <Toc {...toc} />
              </div>
            </Drawer>
          </Fragment>
        )}
        <main>
          {children}
          <div className="meta">
            {page?.repo && (
              <a className="edit-github" href={page.repo}>
                {typeof hyperbook.repo == "object" && hyperbook.repo.label
                  ? hyperbook.repo.label
                  : "✎ GitHub"}
              </a>
            )}
            {(hyperbook as any).vercel && (
              <a
                className="vercel"
                href="https://vercel.com/?utm_source=openpatch&utm_campaign=oss"
              >
                <img
                  src="https://www.openpatch.org/static/powered-by-vercel-black.svg"
                  width={212}
                  height={44}
                />
              </a>
            )}
            <span className="copyright">
              {hyperbook.license
                ? linkLicense(hyperbook.license)
                : `© Copyright ${new Date().getFullYear()}`}
              {hyperbook.author && (
                <>
                  {" by "}
                  <a href={hyperbook.author.url}>{hyperbook.author.name}</a>
                </>
              )}
              .
            </span>
          </div>
        </main>
      </div>
    </Fragment>
  );
};
