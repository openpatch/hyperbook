import { GetStaticPaths, GetStaticProps } from "next";
import path from "path";
import fs from "fs";
import { Layout } from "../../components/Layout";
import { getAllFiles } from "../../utils/files";
import matter from "gray-matter";
import { getNavigation, Navigation, Page } from "../../utils/navigation";
import { getHyperbook, Hyperbook } from "../../utils/hyperbook";
import { Markdown } from "../../components/Markdown";

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

  return {
    props: {
      term: {
        ...(data as TermProps["term"]),
        repo: hyperbook.repo + href + ".md",
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
