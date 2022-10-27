import { GetStaticPaths, GetStaticProps } from "next";
import path from "path";
import { Shell, ShellProps } from "@hyperbook/shell";
import { Fragment } from "react";
import { parseTocFromMarkdown, TocProps } from "@hyperbook/toc";

import { useActivePageId, useLink } from "@hyperbook/provider";
import { Markdown } from "@hyperbook/markdown";
import {
  readFile,
  readGlossary,
  makeNavigationForHyperbook,
  readHyperbook,
  listPagesForTerm,
} from "@hyperbook/fs";

type TermProps = {
  markdown: string;
  navigation: ShellProps["navigation"];
  toc: TocProps;
  term: {
    name: string;
    repo: string;
    pages: ShellProps["navigation"]["pages"];
    toc?: boolean;
  };
};

export default function Term({ markdown, navigation, term, toc }: TermProps) {
  const Link = useLink();
  useActivePageId();
  return (
    <Shell
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
    </Shell>
  );
}

export const getStaticProps: GetStaticProps<
  TermProps,
  {
    term: string[];
  }
> = async ({ params }) => {
  const root = process.env.root ?? process.cwd();
  const filePath = path.join(root, "glossary", ...params.term);
  const href = "/glossary/" + path.join(...params.term);
  const { content, data } = await readFile(filePath + ".md");

  const navigation = await makeNavigationForHyperbook(root, href);
  const hyperbook = await readHyperbook(root);
  const pages = await listPagesForTerm(root, params.term[0]);

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
      toc: parseTocFromMarkdown(content),
      navigation,
      hyperbook,
    },
  };
};

export const getStaticPaths: GetStaticPaths<{
  term: string[];
}> = async () => {
  const root = process.env.root ?? process.cwd();
  const files = await readGlossary(root);
  const paths = files.map((f) => {
    const relativePath = path
      .relative(path.join(root, "glossary"), f)
      .replace(/\.md$/, "")
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
