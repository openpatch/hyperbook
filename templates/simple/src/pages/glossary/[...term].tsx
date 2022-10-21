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
import { Fragment } from "react";
import { getHyperbook } from "../../utils/hyperbook";

import { getToc, Toc } from "../../utils/toc";
import { useActivePageId, useLink } from "@hyperbook/provider";
import { Markdown } from "@hyperbook/markdown";

const hyperbook = getHyperbook();

type TermProps = {
  markdown: string;
  navigation: Navigation;
  toc: Toc;
  term: {
    name: string;
    repo: string;
    pages: Page[];
    toc?: boolean;
  };
};

export default function Term({ markdown, navigation, term, toc }: TermProps) {
  const Link = useLink();
  useActivePageId();
  return (
    <Layout
      navigation={navigation}
      page={term}
      toc={term?.toc === true ? toc : null}
    >
      <article>
        <Markdown children={markdown} />
        <div className="pages">
          {term.pages.map((p, i) => (
            <Fragment key={p.href}>
              {i > 0 && ", "}
              <Link href={p.href}>{p.name}</Link>
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
  let filePath = path.join(process.env.root ?? process.cwd(), "glossary");
  filePath = path.join(filePath, ...params.term);
  const href = "/glossary/" + path.join(...params.term);
  const source = fs.readFileSync(filePath + ".md");
  const { content, data } = matter(source);

  const navigation = await getNavigation(href);

  const files = getAllFiles(
    path.join(process.env.root ?? process.cwd(), "book")
  );
  const pages: Page[] = [];
  for (const file of files) {
    const { content, data } = readFile(file);
    const r = new RegExp(
      `:t\\[.*\\]\\{#${params.term}(\..*)?\\}|:t\\[${params.term}\\]`
    );
    const m = content.match(r);
    if (m && !data.hide && data.name) {
      const relativePath = path
        .relative(path.join(process.env.root ?? process.cwd(), "book"), file)
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

  const term: TermProps["term"] = {
    ...(data as TermProps["term"]),
    pages,
  };

  if (hyperbook?.repo) {
    term.repo = hyperbook.repo + href + ".md";
  }

  return {
    props: {
      locale: data?.lang || hyperbook.language,
      term,
      markdown: content,
      toc: getToc(content),
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
