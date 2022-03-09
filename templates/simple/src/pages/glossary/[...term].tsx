import { GetStaticPaths, GetStaticProps } from "next";
import path from "path";
import fs from "fs";
import { Layout } from "../../components/Layout";
import { getAllFiles } from "../../utils/files";
import matter from "gray-matter";
import {
  getNavigation,
  Navigation,
  Page,
  readFile,
} from "../../utils/navigation";
import { getHyperbook, Hyperbook } from "../../utils/hyperbook";
import { Markdown } from "../../components/Markdown";
import Link from "next/link";
import { Fragment } from "react";

type TermProps = {
  markdown: string;
  navigation: Navigation;
  hyperbook: Hyperbook;
  term: {
    name: string;
    repo: string;
    pages: Page[];
  };
};

export default function Term({
  markdown,
  navigation,
  hyperbook,
  term,
}: TermProps) {
  return (
    <Layout navigation={navigation} hyperbook={hyperbook} page={term}>
      <article>
        <Markdown children={markdown} />
        <div className="pages">
          {term.pages.map((p, i) => (
            <Fragment key={p.href}>
              {i > 0 && ", "}
              <Link href={p.href}>
                <a>{p.name}</a>
              </Link>
            </Fragment>
          ))}
        </div>
      </article>
    </Layout>
  );
}

export const getStaticProps: GetStaticProps<
  TermProps,
  {
    term: string[];
  }
> = async ({ params }) => {
  let filePath = path.join(process.cwd(), "glossary");
  filePath = path.join(filePath, ...params.term);
  const href = "/glossary/" + path.join(...params.term);
  const source = fs.readFileSync(filePath + ".md");
  const { content, data } = matter(source);

  const navigation = await getNavigation(href);
  const hyperbook = await getHyperbook();

  const files = getAllFiles("book");
  const pages: Page[] = [];
  for (const file of files) {
    const { content, data } = readFile(file);
    const r = new RegExp(
      `:t\\[.*\\]\\{#${params.term}\\}|:t\\[${params.term}\\]`
    );
    const m = content.match(r);
    if (m) {
      const relativePath = path
        .relative("book", file)
        .replace(/\.mdx?$/, "")
        .split("/");
      const isIndex = relativePath[relativePath.length - 1] === "index";
      if (isIndex) {
        relativePath.pop();
      }
      pages.push({
        ...data,
        href: "/" + relativePath.join("/"),
      });
    }
  }

  return {
    props: {
      term: {
        ...(data as TermProps["term"]),
        repo: hyperbook.repo + href + ".md",
        pages,
      },
      markdown: content,
      navigation,
      hyperbook,
    },
  };
};

export const getStaticPaths: GetStaticPaths<{
  term: string[];
}> = async () => {
  const files = getAllFiles("glossary");
  const paths = files.map((f) => {
    const relativePath = path
      .relative("glossary", f)
      .replace(/\.mdx?$/, "")
      .split("/");

    return {
      params: {
        term: relativePath,
      },
    };
  });

  return {
    paths,
    fallback: false,
  };
};
