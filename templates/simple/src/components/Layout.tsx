import Head from "next/head";
import Link from "next/link";
import { Fragment, ReactNode, useState } from "react";
import { getHyperbook } from "../utils/hyperbook";
import { Navigation as NavigationProps, Page } from "../utils/navigation";
import { Toc as TocProps } from "../utils/toc";
import Drawer from "./Drawer";
import { Navigation } from "./Navigation";
import { Toc } from "./Toc";

const hyperbook = getHyperbook();

export type LayoutProps = {
  navigation: NavigationProps;
  toc?: TocProps;
  page: Pick<Page, "name" | "repo" | "description" | "keywords">;
  children: ReactNode;
};

const linkLicense = (license: string) => {
  let href: string;
  let label: string;
  console.log(license);
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
      <Link href={href}>
        <a rel="license">Licensed under {label}</a>
      </Link>
    );
  }

  return license;
};

const relativeUrl = (url: string) => {
  const { basePath } = hyperbook;
  if (
    process.env.NODE_ENV !== "production" &&
    basePath &&
    url.startsWith("/")
  ) {
    if (basePath.endsWith("/")) {
      return basePath.slice(0, -1) + url;
    } else {
      return basePath + url;
    }
  } else {
    return url;
  }
};

export function Layout({ toc, navigation, page, children }: LayoutProps) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  return (
    <>
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
      <div className="main-grid">
        <header
          className={hyperbook?.colors?.inverted ? "inverted" : undefined}
        >
          <div className="mobile-nav">
            <button
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
                <Navigation {...navigation} />
                {hyperbook.author ? (
                  <a className="author" href={hyperbook.author.url}>
                    {hyperbook.author.name}
                  </a>
                ) : (
                  <a className="author" href="https://hyperbook.openpatch.org">
                    Powered by <b>Hyperbook</b>
                  </a>
                )}
              </div>
            </Drawer>
          </div>
          <Link href="/">
            <a className="branding">
              {hyperbook.logo && (
                <div className="logo">
                  <img
                    alt="Logo"
                    width="auto"
                    height={50}
                    src={relativeUrl(hyperbook.logo)}
                  />
                </div>
              )}
              <div className="name">{hyperbook.name}</div>
            </a>
          </Link>
        </header>
        <div className="sidebar">
          <Navigation {...navigation} />
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
            {page.repo && (
              <a className="edit-github" href={page.repo}>
                ✎ GitHub
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
    </>
  );
}
