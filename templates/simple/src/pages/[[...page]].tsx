import fs from "fs";
import matter from "gray-matter";
import { GetStaticPaths, GetStaticProps } from "next";
import Head from "next/head";
import Link from "next/link";
import path from "path";
import { Markdown } from "../components/Markdown";
import { getAllFiles } from "../utils/files";
import { getHyperbook, Hyperbook } from "../utils/hyperbook";
import { Page, Navigation, getNavigation } from "../utils/navigation";

type PageProps = {
  markdown: string;
  navigation: Navigation;
  hyperbook: Hyperbook;
};

export default function BookPage({
  markdown,
  hyperbook,
  navigation,
}: PageProps) {
  const page = navigation.current;
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
        <style>
          {`
          :root {
            --accent-color: ${hyperbook.colors?.accent || "cornflowerBlue"};
            --header-color: ${hyperbook.colors?.header || "#041126"};
          }`}
        </style>
      </Head>
      <div className="main-grid">
        <header>
          <nav className="header"></nav>
          <Link href="/">
            <a className="branding">
              {hyperbook.logo && (
                <img className="logo" src={hyperbook.logo}></img>
              )}
              <div className="name">{hyperbook.name}</div>
            </a>
          </Link>
          <div className="header-links"></div>
          <div className="search"></div>
        </header>
        <nav className="sidebar">nav</nav>
        <main>
          <article>
            <Markdown children={markdown} />
          </article>
          <div className="jump-container">
            {navigation.previous ? (
              <Link href={navigation.previous.href}>
                <a className="jump previous">{navigation.previous.name}</a>
              </Link>
            ) : (
              <div className="flex" />
            )}
            {navigation.next ? (
              <Link href={navigation.next.href}>
                <a className="jump next">{navigation.next.name}</a>
              </Link>
            ) : (
              <div className="flex" />
            )}
          </div>

          <div className="meta">
            {page.repo && (
              <a className="edit-github" href={page.repo}>
                ✎ GitHub
              </a>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export const getStaticProps: GetStaticProps<
  PageProps,
  {
    page: string[];
  }
> = async ({ params }) => {
  let source: Buffer;
  let filePath = path.join(process.cwd(), "book");
  let href = "/";
  if (params.page) {
    filePath = path.join(filePath, ...params.page);
    href = "/" + path.join(...params.page);
  }
  try {
    source = fs.readFileSync(filePath + ".md");
  } catch (e) {
    source = fs.readFileSync(path.join(filePath, "index") + ".md");
  }
  const { content } = matter(source);

  const navigation = await getNavigation(href);
  const hyperbook = await getHyperbook();

  return {
    props: {
      markdown: content,
      navigation,
      hyperbook,
    },
  };
};

export const getStaticPaths: GetStaticPaths<{
  page: string[];
}> = async () => {
  const files = getAllFiles("book");
  const paths = files.map((f) => {
    const relativePath = path
      .relative("book", f)
      .replace(/\.mdx?$/, "")
      .split("/");
    const isIndex = relativePath[relativePath.length - 1] === "index";
    if (isIndex) {
      relativePath.pop();
    }
    return {
      params: {
        page: relativePath,
      },
    };
  });

  return {
    paths,
    fallback: false,
  };
};
