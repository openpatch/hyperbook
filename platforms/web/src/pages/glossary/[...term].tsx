import { GetStaticPaths, GetStaticProps } from "next";
import { Shell, ShellProps } from "@hyperbook/shell";
import { Fragment } from "react";
import { getToc, TocProps } from "@hyperbook/toc";

import { useActivePageId, useLink } from "@hyperbook/provider";
import { Markdown } from "@hyperbook/markdown";
import { glossary, hyperbook, vfile } from "@hyperbook/fs";
import { useScrollHash } from "../../useScrollHash";

type TermProps = {
  markdown: string;
  navigation: ShellProps["navigation"];
  toc: TocProps;
  references: vfile.VFile[];
};

export default function Term({
  markdown,
  navigation,
  references,
  toc,
}: TermProps) {
  const Link = useLink();
  useActivePageId();
  useScrollHash();
  return (
    <Shell navigation={navigation} toc={toc}>
      <article>
        <Markdown children={markdown} />
        <div className="pages">
          {references.map((p, i) => (
            <Fragment key={p.path.href}>
              {i > 0 && ", "}
              <Link href={p.path.href}>{p.name}</Link>
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

  const file = await vfile.get(
    root,
    "glossary",
    "/glossary/" + params.term.join("/")
  );
  if (!file) {
    throw Error(`Missing file ${file}`);
  }
  const references = await glossary.getReferences(file);
  const { content, data } = await vfile.getMarkdown(file);
  const hyperbookJson = await hyperbook.getJson(root);
  const navigation = await hyperbook.getNavigation(root, file);

  return {
    props: {
      locale: data?.lang || hyperbookJson.language,
      markdown: content,
      references,
      toc: getToc(content),
      navigation,
    },
  };
};

export const getStaticPaths: GetStaticPaths<{
  term: string[];
}> = async () => {
  const root = process.env.root ?? process.cwd();
  const files = await vfile.listForFolder(
    root,
    "glossary",
    glossary.allowedGlossaryFiles
  );
  const paths = files.map((f) => ({
    params: {
      term: f.path.href.slice(10).split("/"),
    },
  }));

  return {
    paths,
    fallback: false,
  };
};
