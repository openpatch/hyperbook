import fs from "fs";
import matter from "gray-matter";
import { GetStaticPaths, GetStaticProps } from "next";
import path from "path";
import { Shell, ShellProps } from "@hyperbook/shell";
import { getAllFiles } from "../utils/files";
import { getNavigation } from "../utils/navigation";
import { parseTocFromMarkdown, TocProps } from "@hyperbook/toc";
import { Markdown } from "@hyperbook/markdown";
import { useActivePageId, useLink } from "@hyperbook/provider";
import { getHyperbook } from "../utils/hyperbook";
import { Fragment } from "react";

type PageProps = {
  markdown: string;
  navigation: ShellProps["navigation"];
  toc: TocProps;
};

const hyperbook = getHyperbook();

export default function BookPage({ markdown, navigation, toc }: PageProps) {
  const page = navigation.current;
  const Link = useLink();
  useActivePageId();

  return (
    <Fragment>
      <Shell
        navigation={navigation}
        page={page}
        toc={page.toc == false ? null : toc}
      >
        <article>
          <Markdown children={markdown} />
        </article>
        <div className="jump-container">
          {navigation.previous ? (
            <Link className="jump previous" href={navigation.previous.href}>
              {navigation.previous.name}
            </Link>
          ) : (
            <div className="flex" />
          )}
          {navigation.next ? (
            <Link className="jump next" href={navigation.next.href}>
              {navigation.next.name}
            </Link>
          ) : (
            <div className="flex" />
          )}
        </div>
      </Shell>
    </Fragment>
  );
}

export const getStaticProps: GetStaticProps<
  PageProps,
  {
    page: string[];
  }
> = async ({ params }) => {
  let source: Buffer;
  let filePath = path.join(process.env.root ?? process.cwd(), "book");
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
  const { content, data } = matter(source);

  const navigation = await getNavigation(href);
  return {
    props: {
      locale: data?.lang || hyperbook.language,
      markdown: content,
      toc: parseTocFromMarkdown(content),
      navigation,
    },
  };
};

export const getStaticPaths: GetStaticPaths<{
  page: string[];
}> = async () => {
  const files = getAllFiles(
    path.join(process.env.root ?? process.cwd(), "book")
  );
  const paths = files.map((f) => {
    const relativePath = path
      .relative(path.join(process.env.root ?? process.cwd(), "book"), f)
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
