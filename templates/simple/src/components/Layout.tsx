import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { ReactNode, useState } from "react";
import { Hyperbook } from "../utils/hyperbook";
import { Navigation as NavigationProps, Page } from "../utils/navigation";
import Drawer from "./Drawer";
import { Navigation } from "./Navigation";

export type LayoutProps = {
  hyperbook: Hyperbook;
  navigation: NavigationProps;
  page: Pick<Page, "name" | "repo" | "description" | "keywords">;
  children: ReactNode;
};

export function Layout({ hyperbook, navigation, page, children }: LayoutProps) {
  const [isOpen, setIsOpen] = useState(false);
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
        <header>
          <div className="mobile-nav">
            <button
              className={isOpen ? "toggle change" : "toggle"}
              onClick={() => setIsOpen(!isOpen)}
            >
              <div className="bar1"></div>
              <div className="bar2"></div>
              <div className="bar3"></div>
            </button>
            <Drawer
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
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
                  <Image
                    alt="Logo"
                    width={50}
                    height={50}
                    src={hyperbook.logo}
                  />
                </div>
              )}
              <div className="name">{hyperbook.name}</div>
            </a>
          </Link>
          <div className="header-links"></div>
          <div className="search"></div>
        </header>
        <div className="sidebar">
          <Navigation {...navigation} />
          <a className="author" href="https://hyperbook.openpatch.org">
            Powered by <b>Hyperbook</b>
          </a>
        </div>
        <main>
          {children}
          <div className="meta">
            {page.repo && (
              <a className="edit-github" href={page.repo}>
                ✎ GitHub
              </a>
            )}
            {hyperbook.author && (
              <span className="copyright">
                © Copyright {new Date().getFullYear()}.{" "}
                <a href={hyperbook.author.url}>{hyperbook.author.name}</a>.
              </span>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
