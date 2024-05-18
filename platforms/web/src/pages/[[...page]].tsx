import React from "react";
import { GetStaticPaths, GetStaticProps } from "next";
import { Shell, ShellProps } from "@hyperbook/shell";
import { Markdown } from "@hyperbook/markdown";
import { useActivePageId, useLink } from "@hyperbook/provider";
import { Fragment } from "react";
import { vfile, hyperbook } from "@hyperbook/fs";
import { useScrollHash } from "../useScrollHash";
import path from "path";
import { HyperbookPage } from "@hyperbook/types";

type PageProps = {
  markdown: string;
  data: HyperbookPage;
  navigation: ShellProps["navigation"];
};

export default function BookPage({ markdown, data, navigation }: PageProps) {
  const Link = useLink();
  useActivePageId();
  useScrollHash();

  return (
    <Fragment>
      <Shell navigation={navigation}>
        <article>
          <Markdown children={markdown} showToc={data.toc !== false} />
        </article>
        {!data.hide && (
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
        )}
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

  let href = "";
  if (params.page) {
    href = path.join(...params.page);
  }
  const file = await vfile.get(root, "book", "/" + href);
  const { content, data } = file.markdown;
  const hyperbookJson = await hyperbook.getJson(root);
  const navigation = await hyperbook.getNavigation(root, file);

  return {
    props: {
      locale: data?.lang || hyperbookJson.language,
      markdown: content,
      data,
      navigation,
    },
  };
};

export const getStaticPaths: GetStaticPaths<{
  page: string[];
}> = async () => {
  const root = process.env.root ?? process.cwd();
  const files = await vfile.listForFolder(root, "book");
  const paths = files.map((f) => {
    const page = f.path.href.slice(1).split("/");
    if (f.name === "index" && f.path.directory === "") {
      page.pop();
    }
    return {
      params: {
        page,
      },
    };
  });

  return {
    paths,
    fallback: false,
  };
};
