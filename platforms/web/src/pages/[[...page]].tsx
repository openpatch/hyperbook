import { GetStaticPaths, GetStaticProps } from "next";
import path from "path";
import { Shell, ShellProps } from "@hyperbook/shell";
import { parseTocFromMarkdown, TocProps } from "@hyperbook/toc";
import { Markdown } from "@hyperbook/markdown";
import { useActivePageId, useLink } from "@hyperbook/provider";
import { Fragment } from "react";
import {
  makeNavigationForHyperbook,
  readBook,
  readFile,
  readHyperbook,
} from "@hyperbook/fs";
import { useScrollHash } from "../useScrollHash";

type PageProps = {
  markdown: string;
  navigation: ShellProps["navigation"];
  toc: TocProps;
};

export default function BookPage({ markdown, navigation, toc }: PageProps) {
  const page = navigation.current;
  const Link = useLink();
  useActivePageId();
  useScrollHash();

  return (
    <Fragment>
      <Shell navigation={navigation} toc={page.toc == false ? null : toc}>
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
  const root = process.env.root ?? process.cwd();
  let filePath = path.join(root, "book");
  let href = "/";
  if (params.page) {
    filePath = path.join(filePath, ...params.page);
    href = "/" + path.join(...params.page);
  }
  const { content, data } = await readFile(filePath);

  const hyperbook = await readHyperbook(root);
  const navigation = await makeNavigationForHyperbook(root, href);
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
  const root = process.env.root ?? process.cwd();
  const files = await readBook(root);
  const paths = files.map((f) => {
    const relativePath = path
      .relative(path.join(root, "book"), f)
      .replace(/\.md$/, "")
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
